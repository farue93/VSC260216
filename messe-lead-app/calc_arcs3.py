import math

cx, cy = 896.0, 844.0
w, h = 1792, 1688
crop_x1 = w / 3
crop_y1 = h / 3
crop_w = w / 3
crop_h = h / 3

# Actual purple pixel segments from analysis:
# Right: 52.5-68.5 deg, r=188-289
# Center: 79.5-100.5 deg, r=192-282
# Left: 111.5-128.0 deg, r=188-290
# Ring width ~100px. Half ring width = ~50px shift outward.

segs = [
    {"name": "Right", "start": 52.5, "end": 68.5, "rmin": 188, "rmax": 289, "section": "contact"},
    {"name": "Center", "start": 79.5, "end": 100.5, "rmin": 192, "rmax": 282, "section": "showcase"},
    {"name": "Left", "start": 111.5, "end": 128.0, "rmin": 188, "rmax": 290, "section": "solutions"},
]

PAD_A = 3  # degrees padding each side
SHIFT_OUT = 50  # half ring width outward

def pt(angle_deg, radius):
    rad = math.radians(angle_deg)
    return cx + radius * math.cos(rad), cy + radius * math.sin(rad)

for s in segs:
    a1 = s["start"] - PAD_A
    a2 = s["end"] + PAD_A
    # Shift both radii outward by 50px
    ri = max(150, s["rmin"] - 30 + SHIFT_OUT)
    ro = s["rmax"] + 10 + SHIFT_OUT

    ox1, oy1 = pt(a1, ro)
    ox2, oy2 = pt(a2, ro)
    ix1, iy1 = pt(a2, ri)
    ix2, iy2 = pt(a1, ri)

    d = (f"M {ox1:.1f} {oy1:.1f} A {ro} {ro} 0 0 1 {ox2:.1f} {oy2:.1f} "
         f"L {ix1:.1f} {iy1:.1f} A {ri} {ri} 0 0 0 {ix2:.1f} {iy2:.1f} Z")

    mid_a = (a1 + a2) / 2
    tr = ro - 50
    tx, ty = pt(mid_a, tr)
    tp_l = (tx - crop_x1) / crop_w * 100
    tp_t = (ty - crop_y1) / crop_h * 100

    print(f"{s['name']} ({s['section']}):")
    print(f'  d="{d}"')
    print(f"  tooltip: left={tp_l:.1f}% top={tp_t:.1f}%")
    print()

print(f'SVG viewBox: "{crop_x1:.1f} {crop_y1:.1f} {crop_w:.1f} {crop_h:.1f}"')
