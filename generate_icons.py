from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF, renderPM
from PIL import Image
import io, os

svg_path = "icon.svg"
sizes = [16, 32, 48, 64, 128, 256, 512]
os.makedirs("src-tauri/icons", exist_ok=True)

# Load SVG
drawing = svg2rlg(svg_path)

for size in sizes:
    # Render to PNG using reportlab
    img = renderPM.drawToPIL(drawing, width=size, height=size)
    if size == 32:
        img.save("src-tauri/icons/32x32.png")
    elif size == 128:
        img.save("src-tauri/icons/128x128.png")
    elif size == 256:
        img.save("src-tauri/icons/128x128@2x.png")
    elif size == 512:
        img.save("src-tauri/icons/icon.png")

# Create ICO with multiple sizes
png_images = []
ico_sizes = [16, 32, 48, 64, 128, 256]
for size in ico_sizes:
    img = renderPM.drawToPIL(drawing, width=size, height=size)
    png_images.append(img.convert("RGBA"))

png_images[0].save("src-tauri/icons/icon.ico", format="ICO", sizes=[(s,s) for s in ico_sizes], append_images=png_images[1:])
print("All icons generated.")