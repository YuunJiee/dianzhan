"""產生 App 圖示與啟動畫面：粉橘車票紙上，蓋一個朱紅雙圈的「點」字站章。

設計改了就重新執行（需要 Pillow）：
  python -I app/scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ASSETS = Path(__file__).resolve().parent.parent / "assets"
FONT = ASSETS / "fonts" / "TicketSerif.ttf"

TICKET = (238, 211, 191)  # colors.ticket
STAMP = (184, 50, 42)  # colors.stamp
SCALE = 4  # 先畫 4 倍大再縮小，邊緣才平滑


def stamp(diameter: int, color: tuple[int, int, int], angle: float = -8) -> Image.Image:
    """透明底的站章：外粗內細雙圈，中間一個「點」。"""
    size = diameter * SCALE
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    outer = size * 0.045  # 外圈線寬
    d.ellipse([outer / 2, outer / 2, size - outer / 2, size - outer / 2], outline=color, width=round(outer))
    gap = size * 0.085
    inner = size * 0.016
    d.ellipse([gap, gap, size - gap, size - gap], outline=color, width=round(inner))
    font = ImageFont.truetype(str(FONT), round(size * 0.56))
    # 依字形實際外框置中，不受字型上下留白影響
    left, top, right, bottom = d.textbbox((0, 0), "點", font=font)
    d.text(((size - (right - left)) / 2 - left, (size - (bottom - top)) / 2 - top), "點", font=font, fill=color)
    img = img.rotate(angle, resample=Image.BICUBIC)
    return img.resize((diameter, diameter), Image.LANCZOS)


def on_background(canvas: int, mark_diameter: int, background, color=STAMP) -> Image.Image:
    img = Image.new("RGBA", (canvas, canvas), background)
    mark = stamp(mark_diameter, color)
    offset = (canvas - mark_diameter) // 2
    img.alpha_composite(mark, (offset, offset))
    return img


def main() -> None:
    # 一般圖示（iOS、舊版 Android、商店）：整張車票紙色
    on_background(1024, 700, TICKET + (255,)).convert("RGB").save(ASSETS / "icon.png")
    # Android 自適應圖示：前景要留在中間約 61% 的安全範圍內，背景是純車票紙色
    on_background(512, 290, (0, 0, 0, 0)).save(ASSETS / "android-icon-foreground.png")
    Image.new("RGB", (512, 512), TICKET).save(ASSETS / "android-icon-background.png")
    # Android 13 主題圖示：單色，系統會自行上色
    on_background(432, 250, (0, 0, 0, 0), color=(255, 255, 255)).save(ASSETS / "android-icon-monochrome.png")
    # 啟動畫面（底色在 app.json 設定為紙色）
    on_background(1024, 1024, (0, 0, 0, 0)).save(ASSETS / "splash-icon.png")
    on_background(48, 44, TICKET + (255,)).save(ASSETS / "favicon.png")
    print("已更新 assets/ 的圖示與啟動畫面")


if __name__ == "__main__":
    main()
