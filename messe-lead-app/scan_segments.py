from PIL import Image
import numpy as np
import math

img = Image.open('13459_OCTRION_Bildmarke_RGB_lila.png').convert('RGBA')
w, h = img.size
data = np.array(img)
cx, cy = w / 2, h / 2
print(f"Image: {w}x{h}, center: ({cx}, {cy})")

purple_mask = (
    (data[:, :, 0] < 140) &
    (data[:, :, 1] < 100) &
    (data[:, :, 2] > 100) &
    (data[:, :, 3] > 128)
)

# Full 360 scan with 0.5 degree steps
segments = []
current_seg = None
for a10 in range(0, 3600, 5):
    a = a10 / 10.0
    angle_rad = math.radians(a)
    radii = []
    for r in range(100, 500, 1):
        px = int(cx + r * math.cos(angle_rad))
        py = int(cy + r * math.sin(angle_rad))
        if 0 <= px < w and 0 <= py < h and purple_mask[py, px]:
            radii.append(r)
    if radii:
        rmin, rmax = min(radii), max(radii)
        if current_seg is None:
            current_seg = {"start": a, "end": a, "rmin": rmin, "rmax": rmax}
        else:
            current_seg["end"] = a
            current_seg["rmin"] = min(current_seg["rmin"], rmin)
            current_seg["rmax"] = max(current_seg["rmax"], rmax)
    else:
        if current_seg is not None:
            segments.append(current_seg)
            current_seg = None
if current_seg:
    segments.append(current_seg)

print("\n=== ALL PURPLE SEGMENTS ===")
for i, s in enumerate(segments):
    span = s["end"] - s["start"]
    print(f"  Seg {i}: {s['start']:.1f} - {s['end']:.1f} deg (span {span:.1f}), r={s['rmin']}-{s['rmax']}")

print("\n=== BOTTOM SEGMENTS (tentacle tips at 40-140 deg) ===")
for s in segments:
    mid = (s["start"] + s["end"]) / 2
    span = s["end"] - s["start"]
    if 40 < mid < 140 and span < 40:
        mid_rad = math.radians(mid)
        mid_r = (s["rmin"] + s["rmax"]) / 2
        px_pt = cx + mid_r * math.cos(mid_rad)
        py_pt = cy + mid_r * math.sin(mid_rad)
        print(f"  {s['start']:.1f} - {s['end']:.1f} deg (span {span:.1f}), r={s['rmin']}-{s['rmax']}")
        print(f"    Center pixel: ({px_pt:.0f}, {py_pt:.0f}), mid_angle={mid:.1f}, mid_r={mid_r:.0f}")

# Now compute SVG arc paths for the cropped coordinate system
# The 300%/-100% crop means the visible area is the center third:
# x: w/3 to 2w/3,  y: h/3 to 2h/3
# In the SVG viewBox that maps to the splash-o div, we need the viewBox
# to represent the cropped region.
crop_x1 = w / 3
crop_y1 = h / 3
crop_w = w / 3
crop_h = h / 3
print(f"\nCrop region: x={crop_x1:.1f}, y={crop_y1:.1f}, w={crop_w:.1f}, h={crop_h:.1f}")

# Generate SVG arcs for the 3 bottom segments
# We want the arcs to be slightly LARGER than the actual purple pixels 
# to make them easier to click (the user wants them "etwas weiter nach aussen")
print("\n=== SVG ARC PATHS (in full image coords) ===")
bottom_segs = []
for s in segments:
    mid = (s["start"] + s["end"]) / 2
    span = s["end"] - s["start"]
    if 40 < mid < 140 and span < 40:
        bottom_segs.append(s)

# Expand each segment by a few degrees on each side and increase radius
PAD_DEG = 4  # degrees padding on each side
PAD_R_INNER = -20  # shrink inner radius (= grow clickable area inward)
PAD_R_OUTER = 25   # grow outer radius outward

for i, s in enumerate(bottom_segs):
    name = ["Left", "Center", "Right"][i] if i < 3 else f"Seg{i}"
    a1 = s["start"] - PAD_DEG
    a2 = s["end"] + PAD_DEG
    r_inner = max(100, s["rmin"] + PAD_R_INNER)
    r_outer = s["rmax"] + PAD_R_OUTER
    
    # SVG arc: outer arc from a1 to a2, then inner arc from a2 to a1
    # Convert math angles (0=right, CW in image coords) to SVG coords
    # In SVG/image coords, Y increases downward, angles go clockwise
    def pt(angle_deg, radius):
        rad = math.radians(angle_deg)
        x = cx + radius * math.cos(rad)
        y = cy + radius * math.sin(rad)
        return x, y
    
    # Outer arc: from a1 to a2 (clockwise in image = clockwise in SVG)
    ox1, oy1 = pt(a1, r_outer)
    ox2, oy2 = pt(a2, r_outer)
    # Inner arc: from a2 to a1 (counter-clockwise = sweep-flag 0)
    ix1, iy1 = pt(a2, r_inner)
    ix2, iy2 = pt(a1, r_inner)
    
    arc_span = a2 - a1
    large_arc = 1 if arc_span > 180 else 0
    
    # Path: Move to outer start, arc to outer end, line to inner end, arc back to inner start, close
    d = (f"M {ox1:.1f} {oy1:.1f} "
         f"A {r_outer} {r_outer} 0 {large_arc} 1 {ox2:.1f} {oy2:.1f} "
         f"L {ix1:.1f} {iy1:.1f} "
         f"A {r_inner} {r_inner} 0 {large_arc} 0 {ix2:.1f} {iy2:.1f} Z")
    
    print(f"\n  {name} ({a1:.1f} - {a2:.1f} deg, r={r_inner}-{r_outer}):")
    print(f"    d=\"{d}\"")
    
    # Also show percentage positions for tooltip placement (relative to crop region)
    mid_angle = (a1 + a2) / 2
    # Tooltip should be just outside the outer radius
    tooltip_r = r_outer + 15
    tx, ty = pt(mid_angle, tooltip_r)
    # Convert to percentage of crop region
    tx_pct = (tx - crop_x1) / crop_w * 100
    ty_pct = (ty - crop_y1) / crop_h * 100
    print(f"    Tooltip: left={tx_pct:.1f}%, top={ty_pct:.1f}%")

print(f"\nSVG viewBox for crop: \"{crop_x1:.1f} {crop_y1:.1f} {crop_w:.1f} {crop_h:.1f}\"")
