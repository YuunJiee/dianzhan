"""把 Noto Serif TC（明體）裁成只含車站名稱與固定標題用字的小字型，給車票、站章使用。

完整字型 16 MB，裁剪後只有幾十 KB。車站改名或新增時重新執行；缺字會自動改用系統字型顯示。

用法（字型原檔從 https://github.com/google/fonts/tree/main/ofl/notoseriftc 下載）：
  python -I app/scripts/subset-font.py <NotoSerifTC[wght].ttf 的路徑>
"""

import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent.parent
STATIONS = ROOT / "docs" / "data" / "stations.json"
OUT = ROOT / "app" / "assets" / "fonts" / "TicketSerif.ttf"

# 車票、站章上會出現的固定文字（站名以外）
EXTRA = (
    "點站集站紀錄打卡完成新車站點亮已第一次來過臺灣鐵路紀念章車票乘車日期民國年月日"
    "去回程往返出發抵達可停留小時分直達轉乘次"
    "〇一二三四五六七八九十百"
    "0123456789.:/-()・，。！？ "
)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    names = [s["name"] for s in json.loads(STATIONS.read_text(encoding="utf-8"))]
    text = "".join(names) + EXTRA

    font = TTFont(sys.argv[1])
    font = instancer.instantiateVariableFont(font, {"wght": 700})  # 固定為 Bold，不需要可變字重

    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]  # 保留授權與字型名稱資訊（OFL 要求）
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)
    print(f"{len(set(text))} 個字 → {OUT.relative_to(ROOT)}（{OUT.stat().st_size // 1024} KB）")


if __name__ == "__main__":
    main()
