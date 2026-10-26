"""TDX API 用戶端：讀 .env 的金鑰、取得 access token、呼叫台鐵 API。"""

import os
import time
from pathlib import Path

import requests

TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
API_BASE = "https://tdx.transportdata.tw/api/basic"
MIN_INTERVAL = 3.0  # 秒


def load_env(path: Path = Path(__file__).resolve().parent.parent / ".env") -> None:
    """把 .env 的 KEY=VALUE 載入環境變數（已存在的不覆蓋，方便 GitHub Actions 用 Secrets）。"""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


class TdxClient:
    def __init__(self) -> None:
        load_env()
        self.client_id = os.environ.get("TDX_CLIENT_ID", "")
        self.client_secret = os.environ.get("TDX_CLIENT_SECRET", "")
        if not self.client_id or not self.client_secret:
            raise SystemExit("找不到 TDX_CLIENT_ID / TDX_CLIENT_SECRET，請在專案根目錄的 .env 填好。")
        self.session = requests.Session()
        self._token = ""
        self._token_expiry = 0.0
        self._last_call = 0.0

    def _ensure_token(self) -> None:
        if self._token and time.time() < self._token_expiry - 60:
            return
        resp = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        self._token = body["access_token"]
        self._token_expiry = time.time() + body.get("expires_in", 3600)

    def get(self, path: str, **params):
        """呼叫 API，path 例如 "/v3/Rail/TRA/Station"。遇到 429 會等一下再試。"""
        self._ensure_token()
        params.setdefault("$format", "JSON")
        # 免費方案有每秒／每分鐘呼叫上限，兩次呼叫之間至少間隔一段時間
        wait = self._last_call + MIN_INTERVAL - time.time()
        if wait > 0:
            time.sleep(wait)
        for attempt in range(6):
            resp = self.session.get(
                API_BASE + path,
                params=params,
                headers={"Authorization": f"Bearer {self._token}", "Accept-Encoding": "gzip"},
                timeout=60,
            )
            self._last_call = time.time()
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After", "")
                delay = int(retry_after) if retry_after.isdigit() else 10 * (attempt + 1)
                print(f"  TDX 呼叫太頻繁，等 {delay} 秒再試")
                time.sleep(delay)
                continue
            resp.raise_for_status()
            return resp.json()
        resp.raise_for_status()
