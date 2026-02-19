"""
Precise scan of the Bildmarke ring to find exact purple segment boundaries.
Uses fine-grained angular + radial sweep to map purple pixels precisely.
Then generates SVG arc paths that exactly overlay those purple areas.
"""
from PIL import Image
import numpy as np
import math

img = Image.open('13459_OCTRION_Bildmarke_RGB_lila.png').convert('RGBA')
w, h = img.size
data = np.array(img)
cx, cy = w / 2, h / 2
print(f"Image: {w}x{h}, center: ({cx}, {cy})")

# Purple mask - match the actual purple ring color
purple_mask = (
    (data[:, :, 0] < 140) &
    (data[:, :, 1] < 100) &
    (data[:, :, 2] > 100) &
    (data[:, :, 3] > 128)
)

# Fine scan: 0.25 degree steps, 1px radial steps
# Focus on bottom region: 40-140 degrees (math convention, 0=right, 90=down)
print("\n=== FINE SCAN: Bottom segments (40-140 deg, 0.25 deg steps) ===")

angle_data = {}
for a_x4 in range(160, 560):  # 40.0 to 140.0 in 0.25 steps
    a = a_x4 / 4.0
    rad = math.radians(a)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    radii = []
    for r in range(100, 500):
        px = int(cx + r * cos_a)
        py = int(cy + r * sin_a)
        if 0 <= px < w and 0 <= py < h and purple_mask[py, px]:
            radii.append(r)
    if radii:
        angle_data[a] = (min(radii), max(radii))

# Find contiguous segments
segments = []
current = None
sorted_angles = sorted(angle_data.keys())
for a in sorted_angles:
    rmin, rmax = angle_data[a]
    if current is None:
        current = {"start": a, "end": a, "rmin": rmin, "rmax": rmax, "radii": [(a, rmin, rmax)]}
    elif a - current["end"] <= 0.5:  # contiguous (within 0.5 deg gap)
        current["end"] = a
        current["rmin"] = min(current["rmin"], rmin)
        current["rmax"] = max(current["rmax"], rmax)
        current["radii"].append((a, rmin, rmax))
    else:
        segments.append(current)
        current = {"start": a, "end": a, "rmin": rmin, "rmax": rmax, "radii": [(a, rmin, rmax)]}
if current:
    segments.append(current)

print(f"\nFound {len(segments)} segments:")
for i, s in enumerate(segments):
    span = s["end"] - s["start"]
    # Compute average inner/outer radii for more accurate arcs
    r_inner_vals = [r[1] for r in s["radii"]]
    r_outer_vals = [r[2] for r in s["radii"]]
    avg_inner = sum(r_inner_vals) / len(r_inner_vals)
    avg_outer = sum(r_outer_vals) / len(r_outer_vals)
    # Also find the stable inner/outer (ignoring tapered ends)
    # Use middle 60% of the segment for stable radius
    n = len(s["radii"])
    trim = max(1, n // 5)
    stable_inner = sorted(r_inner_vals[trim:-trim] if n > 2*trim else r_inner_vals)
    stable_outer = sorted(r_outer_vals[trim:-trim] if n > 2*trim else r_outer_vals)
    med_inner = stable_inner[len(stable_inner)//2]
    med_outer = stable_outer[len(stable_outer)//2]
    
    print(f"\n  Segment {i}: {s['start']:.2f} - {s['end']:.2f} deg (span {span:.2f})")
    print(f"    rmin range: {s['rmin']}-{max(r_inner_vals)}, rmax range: {min(r_outer_vals)}-{s['rmax']}")
    print(f"    avg inner: {avg_inner:.0f}, avg outer: {avg_outer:.0f}")
    print(f"    median inner: {med_inner}, median outer: {med_outer}")
    print(f"    Stable ring: r_inner={med_inner}, r_outer={med_outer}")

# Now generate exact SVG arcs matching the purple pixels
crop_x1 = w / 3
crop_y1 = h / 3
crop_w = w / 3
crop_h = h / 3

def pt(angle_deg, radius):
    rad = math.radians(angle_deg)
    return cx + radius * math.cos(rad), cy + radius * math.sin(rad)

print("\n\n=== SVG ARC PATHS (exact match to purple pixels) ===")
print(f'viewBox: "{crop_x1:.1f} {crop_y1:.1f} {crop_w:.1f} {crop_h:.1f}"')

names = ["Right (Kontakt)", "Center (Showcase)", "Left (Lösungen)"]
sections = ["contact", "showcase", "solutions"]

for i, s in enumerate(segments):
    name = names[i] if i < len(names) else f"Seg{i}"
    section = sections[i] if i < len(sections) else "unknown"
    
    # Use exact pixel boundaries - just add tiny 0.5deg padding for anti-aliasing
    a1 = s["start"] - 0.5
    a2 = s["end"] + 0.5
    
    # Use the actual min/max radii from pixel data (no artificial shift)
    ri = s["rmin"]
    ro = s["rmax"]
    
    ox1, oy1 = pt(a1, ro)
    ox2, oy2 = pt(a2, ro)
    ix1, iy1 = pt(a2, ri)
    ix2, iy2 = pt(a1, ri)
    
    arc_span = a2 - a1
    large_arc = 1 if arc_span > 180 else 0
    
    d = (f"M {ox1:.1f} {oy1:.1f} A {ro} {ro} 0 {large_arc} 1 {ox2:.1f} {oy2:.1f} "
         f"L {ix1:.1f} {iy1:.1f} A {ri} {ri} 0 {large_arc} 0 {ix2:.1f} {iy2:.1f} Z")
    
    # Tooltip position
    mid_a = (a1 + a2) / 2
    tooltip_r = ro + 20  # just outside the ring
    tx, ty = pt(mid_a, tooltip_r)
    tp_l = (tx - crop_x1) / crop_w * 100
    tp_t = (ty - crop_y1) / crop_h * 100
    
    # Also compute inside-ring tooltip for comparison
    tooltip_r2 = (ri + ro) / 2
    tx2, ty2 = pt(mid_a, tooltip_r2)
    tp_l2 = (tx2 - crop_x1) / crop_w * 100
    tp_t2 = (ty2 - crop_y1) / crop_h * 100
    
    print(f"\n  {name} ({section}):")
    print(f"    angles: {a1:.2f} - {a2:.2f} deg")
    print(f"    radii: inner={ri}, outer={ro}")
    print(f'    d="{d}"')
    print(f"    tooltip (outside): left={tp_l:.1f}% top={tp_t:.1f}%")
    print(f"    tooltip (mid-ring): left={tp_l2:.1f}% top={tp_t2:.1f}%")
    
    # Show detail: per-angle inner/outer radii at segment edges
    print(f"    Edge detail:")
    for r_data in s["radii"][:5]:
        print(f"      {r_data[0]:.2f} deg: r={r_data[1]}-{r_data[2]}")
    if len(s["radii"]) > 10:
        print(f"      ...")
    for r_data in s["radii"][-5:]:
        print(f"      {r_data[0]:.2f} deg: r={r_data[1]}-{r_data[2]}")
