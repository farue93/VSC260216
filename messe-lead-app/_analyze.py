from PIL import Image
import numpy as np

# Analyze GROUP logo for O vs CTRION proportions
img = Image.open('13459_OCTRION_GROUP_Logo_RGB_lila.png')
arr = np.array(img)
alpha = arr[:,:,3]
bbox = img.getbbox()
print(f"GROUP Logo: {img.size[0]}x{img.size[1]}, content bbox: {bbox}")

# Top half = OCTRION, Bottom half = KIRCHHOFF GRUPPE
mid_y = (bbox[1] + bbox[3]) // 2

# Analyze OCTRION row (top half)
top_alpha = alpha[bbox[1]:mid_y, :]
top_rows = np.any(top_alpha > 20, axis=1)
top_y_start = np.argmax(top_rows) + bbox[1]
top_y_end = mid_y - np.argmax(top_rows[::-1])
octrion_height = top_y_end - top_y_start
print(f"OCTRION text height: {octrion_height}px (y: {top_y_start}-{top_y_end})")

# Find horizontal segments in OCTRION row only
octrion_alpha = alpha[top_y_start:top_y_end, :]
col_has = np.any(octrion_alpha > 20, axis=0)

in_content = False
segments = []
for c in range(len(col_has)):
    if col_has[c] and not in_content:
        start = c
        in_content = True
    elif not col_has[c] and in_content:
        segments.append((start, c-1))
        in_content = False
if in_content:
    segments.append((start, len(col_has)-1))

print(f"\nOCTRION horizontal segments ({len(segments)}):")
for i, (s,e) in enumerate(segments):
    w = e - s + 1
    print(f"  Seg {i}: cols {s}-{e}, width {w}px")

# The first segment should be the O (Bildmarke)
# The remaining segments are C, T, R, I, O, N
if len(segments) >= 2:
    o_width = segments[0][1] - segments[0][0] + 1
    gap = segments[1][0] - segments[0][1]
    rest_start = segments[1][0]
    rest_end = segments[-1][1]
    rest_width = rest_end - rest_start + 1
    total_width = segments[-1][1] - segments[0][0] + 1
    
    print(f"\nBildmarke O width: {o_width}px")
    print(f"Gap after O: {gap}px")
    print(f"CTRION text width: {rest_width}px")
    print(f"Total OCTRION width: {total_width}px")
    print(f"O/Total ratio: {o_width/total_width:.3f}")
    print(f"O height (from Bildmarke): ", end="")
    
    # Get actual O segment height
    o_seg_alpha = alpha[bbox[1]:bbox[3], segments[0][0]:segments[0][1]+1]
    o_rows = np.any(o_seg_alpha > 20, axis=1)
    o_h_start = np.argmax(o_rows)
    o_h_end = len(o_rows) - np.argmax(o_rows[::-1])
    print(f"{o_h_end - o_h_start}px")
    print(f"O aspect ratio: {o_width/(o_h_end-o_h_start):.3f}")
    print(f"Gap/O width ratio: {gap/o_width:.3f}")

# Also check the CTRION letter spacing
print("\nLetter segments (after O):")
for i in range(1, len(segments)):
    s, e = segments[i]
    w = e - s + 1
    if i > 1:
        gap_from_prev = s - segments[i-1][1]
        print(f"  Letter {i}: width {w}px, gap from prev: {gap_from_prev}px")
    else:
        print(f"  Letter {i}: width {w}px (first after O)")

# Now analyze the Bildmarke PNG separately
bm = Image.open('13459_OCTRION_Bildmarke_RGB_lila.png')
bm_bbox = bm.getbbox()
bm_w = bm_bbox[2] - bm_bbox[0]
bm_h = bm_bbox[3] - bm_bbox[1]
print(f"\nBildmarke PNG: {bm.size[0]}x{bm.size[1]}, content: {bm_w}x{bm_h}, ratio: {bm_w/bm_h:.3f}")
