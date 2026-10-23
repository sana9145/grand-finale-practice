# Makes the home-screen icons (icons/icon-192.png, icon-512.png, apple-touch-icon.png).
# Usage: python tools/make-icons.py   (needs Pillow; only needed if you want to change the icons)
import os
from PIL import Image, ImageDraw, ImageFont

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'icons')
os.makedirs(out, exist_ok=True)

BRAND = (91, 60, 196)
CREAM = (255, 248, 236)

def font(paths, size):
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()

def icon(size, maskable_pad=0.0):
    img = Image.new('RGBA', (size, size), BRAND)
    d = ImageDraw.Draw(img)
    s = size
    # a spelling tile in the middle
    pad = int(s * (0.18 + maskable_pad))
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=int(s * 0.12), fill=CREAM)
    f = font(['C:/Windows/Fonts/seguibl.ttf', 'C:/Windows/Fonts/arialbd.ttf', '/System/Library/Fonts/Helvetica.ttc'], int(s * 0.36))
    text = 'Aa'
    box = d.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((s - w) / 2 - box[0], (s - h) / 2 - box[1] - s * 0.03), text, font=f, fill=BRAND)
    # a gold star in the corner of the tile
    star = font(['C:/Windows/Fonts/seguisym.ttf', 'C:/Windows/Fonts/arial.ttf'], int(s * 0.16))
    d.text((s - pad - s * 0.17, pad + s * 0.01), '★', font=star, fill=(224, 168, 0))
    return img

icon(192).save(os.path.join(out, 'icon-192.png'))
icon(512).save(os.path.join(out, 'icon-512.png'))
icon(512, 0.06).save(os.path.join(out, 'icon-maskable-512.png'))
icon(180).convert('RGB').save(os.path.join(out, 'apple-touch-icon.png'))
print('icons written to', os.path.abspath(out))
