"""每日批次：抓 TDX 台鐵資料，整理成 App 用的靜態 JSON，輸出到 docs/data/。

輸出：
- stations.json                    有列車停靠的車站
- index.json                       每個日期對應哪個時刻表檔
- timetable-<hash>.json            一份時刻表（內容相同的日期共用同一檔）

用法：
  python build.py                  抓今天起 31 天（約一個月，和台鐵開放訂票的範圍相當）
  python build.py --days 3         只抓 3 天（開發用）
  python build.py --offline        只用 raw/ 已下載的檔案，不連 TDX
"""

import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT = ROOT.parent / "docs" / "data"

# 區間、區間快不用訂位，其餘車種（自強、莒光、普悠瑪、太魯閣…）是對號車
UNRESERVED_TYPE_CODES = {"6", "10"}
# ServiceType 1 = 一般列車；4 = 專開／觀光列車（不單售車票），排除
PUBLIC_SERVICE_TYPE = 1
DEFAULT_DAYS = 31
TAIPEI = timezone(timedelta(hours=8))


def upcoming(dates: list[str], days: int) -> list[str]:
    """今天（台灣時間）起的前 days 天；TDX 的清單會包含昨天。"""
    today = datetime.now(TAIPEI).date().isoformat()
    return [d for d in sorted(dates) if d >= today][:days]


def to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def build_stations(raw_stations: dict, served: set[str]) -> list[dict]:
    stations = []
    for s in raw_stations["Stations"]:
        if s["StationID"] not in served:
            continue
        stations.append(
            {
                "id": s["StationID"],
                "name": s["StationName"]["Zh_tw"],
                "lat": s["StationPosition"]["PositionLat"],
                "lng": s["StationPosition"]["PositionLon"],
            }
        )
    stations.sort(key=lambda s: s["id"])
    return stations


def build_timetable(raw_timetable: dict) -> dict:
    """把一天的時刻表拆成 trips 與 connections。

    時間一律是「當天 00:00 起算的分鐘數」；跨午夜的車次往後加 24 小時（例如 00:15 → 1455），
    這樣同一車次的時間一定遞增，CSA 才能直接依時間排序。

    connections 每筆是 [tripIndex, fromStationId, toStationId, depMinutes, arrMinutes]，依出發時間排序。
    """
    trips = []
    connections = []
    for tt in raw_timetable["TrainTimetables"]:
        info = tt["TrainInfo"]
        if info["ServiceType"] != PUBLIC_SERVICE_TYPE or info["SuspendedFlag"]:
            continue
        stops = [s for s in tt["StopTimes"] if not s["SuspendedFlag"]]
        if len(stops) < 2:
            continue

        trip_index = len(trips)
        trips.append(
            {
                "no": info["TrainNo"],
                "type": info["TrainTypeName"]["Zh_tw"].split("(")[0],
                "reserved": info["TrainTypeCode"] not in UNRESERVED_TYPE_CODES,
            }
        )

        offset = 0
        last = -1
        times = []
        for s in stops:
            arr = to_minutes(s["ArrivalTime"]) + offset
            if arr < last:
                offset += 24 * 60
                arr += 24 * 60
            dep = to_minutes(s["DepartureTime"]) + offset
            if dep < arr:
                offset += 24 * 60
                dep += 24 * 60
            times.append((arr, dep))
            last = dep

        for (a, (_, dep)), (b, (arr, _)) in zip(zip(stops, times), zip(stops[1:], times[1:])):
            connections.append([trip_index, a["StationID"], b["StationID"], dep, arr])

    connections.sort(key=lambda c: (c[3], c[4]))
    return {"trips": trips, "connections": connections}


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def fetch_raw(days: int) -> list[str]:
    """從 TDX 下載車站與每日時刻表到 raw/，回傳日期清單。"""
    from tdx import TdxClient

    client = TdxClient()
    RAW.mkdir(exist_ok=True)
    write_json(RAW / "stations.json", client.get("/v3/Rail/TRA/Station"))
    dates = upcoming(client.get("/v3/Rail/TRA/DailyTrainTimetable/TrainDates")["TrainDates"], days)
    for d in dates:
        print(f"下載 {d} 時刻表")
        write_json(RAW / f"timetable-{d}.json", client.get(f"/v3/Rail/TRA/DailyTrainTimetable/TrainDate/{d}"))
    return dates


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=DEFAULT_DAYS, help=f"抓今天起幾天（預設 {DEFAULT_DAYS}）")
    parser.add_argument("--offline", action="store_true", help="只用 raw/ 已下載的檔案")
    args = parser.parse_args()

    if args.offline:
        dates = upcoming([p.stem.removeprefix("timetable-") for p in RAW.glob("timetable-*.json")], args.days)
    else:
        dates = fetch_raw(args.days)

    raw_stations = json.loads((RAW / "stations.json").read_text(encoding="utf-8"))

    # 舊的時刻表檔先清掉，避免留下沒人引用的檔案
    for old in OUT.glob("timetable-*.json"):
        old.unlink()

    index = {}
    served: set[str] = set()
    for d in dates:
        timetable = build_timetable(json.loads((RAW / f"timetable-{d}.json").read_text(encoding="utf-8")))
        served.update(c[1] for c in timetable["connections"])
        served.update(c[2] for c in timetable["connections"])
        body = json.dumps(timetable, ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(body.encode()).hexdigest()[:12]
        (OUT / f"timetable-{digest}.json").parent.mkdir(parents=True, exist_ok=True)
        (OUT / f"timetable-{digest}.json").write_text(body, encoding="utf-8")
        index[d] = f"timetable-{digest}.json"
        print(f"{d}: {len(timetable['trips'])} 車次、{len(timetable['connections'])} 筆連結 → {index[d]}")

    write_json(OUT / "stations.json", build_stations(raw_stations, served))
    updated_at = datetime.now(TAIPEI).isoformat(timespec="minutes")
    write_json(OUT / "index.json", {"source": "交通部 TDX 運輸資料流通服務", "updatedAt": updated_at, "dates": index})
    print(f"共 {len(served)} 站、{len(dates)} 天、{len(set(index.values()))} 份不同的時刻表")


if __name__ == "__main__":
    main()
