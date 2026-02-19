"""
Final precise SVG arc paths matching exact purple pixel boundaries.
Uses the actual tapered shape of each tentacle segment.
"""
import math

cx, cy = 896.0, 844.0
w, h = 1792, 1688
crop_x1 = w / 3
crop_y1 = h / 3
crop_w = w / 3
crop_h = h / 3

def pt(angle_deg, radius):
    rad = math.radians(angle_deg)
    return cx + radius * math.cos(rad), cy + radius * math.sin(rad)

# Exact purple pixel segments from fine scan:
# The segments are tapered (narrow at tips, wide at base).
# We use the FULL angular range and the OUTER/INNER RADII of the stable middle portion.
# This gives a slightly larger clickable area than the narrowest tips
# while perfectly covering the visible purple area.

segments = [
    {
        "name": "Right", "section": "contact",
        "start": 52.25, "end": 68.75,   # exact pixel boundaries
        "r_inner": 188, "r_outer": 290,  # full pixel range
    },
    {
        "name": "Center", "section": "showcase", 
        "start": 79.50, "end": 100.75,
        "r_inner": 192, "r_outer": 282,
    },
    {
        "name": "Left", "section": "solutions",
        "start": 111.50, "end": 128.00,
        "r_inner": 188, "r_outer": 290,
    },
]

print(f'SVG viewBox: "{crop_x1:.1f} {crop_y1:.1f} {crop_w:.1f} {crop_h:.1f}"')
print()

for s in segments:
    a1 = s["start"]
    a2 = s["end"]
    ri = s["r_inner"]
    ro = s["r_outer"]

    ox1, oy1 = pt(a1, ro)
    ox2, oy2 = pt(a2, ro)
    ix1, iy1 = pt(a2, ri)
    ix2, iy2 = pt(a1, ri)

    d = (f"M {ox1:.1f} {oy1:.1f} A {ro} {ro} 0 0 1 {ox2:.1f} {oy2:.1f} "
         f"L {ix1:.1f} {iy1:.1f} A {ri} {ri} 0 0 0 {ix2:.1f} {iy2:.1f} Z")

    mid_a = (a1 + a2) / 2
    # Tooltip just above the outer ring edge
    tr = ri - 25  # inside, above the segment
    tx, ty = pt(mid_a, tr)
    tp_l = (tx - crop_x1) / crop_w * 100
    tp_t = (ty - crop_y1) / crop_h * 100

    print(f"{s['name']} ({s['section']}):")
    print(f'  d="{d}"')
    print(f"  tooltip: left={tp_l:.1f}% top={tp_t:.1f}%")
    print()
