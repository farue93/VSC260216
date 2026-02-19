from PIL import Image
import numpy as np

# Analyze the newer GROUP logo for cleaner proportions
img = Image.open('13459_OCTRION_GROUP_Logo_RGB_lila_neu.png')
arr = np.array(img)
alpha = arr[:,:,3]

# Overall content bounds
rows = np.any(alpha > 10, axis=1)
cols = np.any(alpha > 10, axis=0)
rmin, rmax = np.where(rows)[0][[0,-1]]
cmin, cmax = np.where(cols)[0][[0,-1]]
print("Image size: %dx%d" % (img.size[0], img.size[1]))
print("Content bounds: x=%d-%d, y=%d-%d" % (cmin, cmax, rmin, rmax))
print("Content size: %dw x %dh" % (cmax-cmin+1, rmax-rmin+1))

# Find the Bildmarke end (first empty column)
bm_end = cmin
for c in range(cmin, cmax):
    if not np.any(alpha[rmin:rmax+1, c] > 10):
        bm_end = c
        break

# Find text start (first non-empty column after gap)
text_start = bm_end
for c in range(bm_end, cmax):
    if np.any(alpha[rmin:rmax+1, c] > 10):
        text_start = c
        break

bm_w = bm_end - cmin
gap = text_start - bm_end
print("\nBildmarke width: %d px" % bm_w)
print("Gap: %d px" % gap)

# Measure Bildmarke height within this image
bm_alpha = alpha[:, cmin:bm_end]
bm_rows = np.any(bm_alpha > 10, axis=1)
bm_rmin, bm_rmax = np.where(bm_rows)[0][[0,-1]]
bm_h = bm_rmax - bm_rmin + 1
print("Bildmarke height in GROUP: %d px (y=%d-%d)" % (bm_h, bm_rmin, bm_rmax))
print("Bildmarke aspect (w/h): %.3f" % (bm_w / bm_h))

# Now find the text region - split into OCTRION line and GROUP line
text_alpha = alpha[:, text_start:cmax+1]
text_rows = np.any(text_alpha > 10, axis=1) 
text_rmin, text_rmax = np.where(text_rows)[0][[0,-1]]
print("\nText region: y=%d-%d, height=%d" % (text_rmin, text_rmax, text_rmax-text_rmin+1))

# Find gap between OCTRION and GROUP text lines
# Scan rows in the text region for empty rows
in_text = False
text_lines = []
line_start = 0
for r in range(text_rmin, text_rmax+1):
    has_content = np.any(text_alpha[r, :] > 10)
    if has_content and not in_text:
        line_start = r
        in_text = True
    elif not has_content and in_text:
        text_lines.append((line_start, r-1))
        in_text = False
if in_text:
    text_lines.append((line_start, text_rmax))

print("\nText lines found: %d" % len(text_lines))
for i, (ls, le) in enumerate(text_lines):
    h = le - ls + 1
    print("  Line %d: y=%d-%d, height=%d px" % (i+1, ls, le, h))

# Compare OCTRION text line height to Bildmarke height
if len(text_lines) >= 1:
    octrion_h = text_lines[0][1] - text_lines[0][0] + 1
    print("\nRATIO ANALYSIS:")
    print("  Bildmarke height: %d" % bm_h)
    print("  OCTRION text height: %d" % octrion_h)
    print("  BM/Text ratio: %.3f" % (bm_h / octrion_h))
    print("  Text/BM ratio: %.3f" % (octrion_h / bm_h))
    # The Bildmarke Y position vs text Y position
    print("  Bildmarke top Y: %d, OCTRION text top Y: %d" % (bm_rmin, text_lines[0][0]))
    print("  Bildmarke bottom: %d, OCTRION text bottom: %d" % (bm_rmax, text_lines[0][1]))
