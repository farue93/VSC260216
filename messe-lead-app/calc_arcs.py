import math

w, h = 1792, 1688
cx, cy = 896, 844
r_inner = 185
r_outer = 288

def arc_point(cx, cy, r, angle_deg):
    rad = math.radians(angle_deg)
    return cx + r * math.cos(rad), cy + r * math.sin(rad)

def arc_path(cx, cy, r_in, r_out, start_deg, end_deg):
    large = 1 if (end_deg - start_deg) > 180 else 0
    ox1, oy1 = arc_point(cx, cy, r_out, start_deg)
    ox2, oy2 = arc_point(cx, cy, r_out, end_deg)
    ix1, iy1 = arc_point(cx, cy, r_in, end_deg)
    ix2, iy2 = arc_point(cx, cy, r_in, start_deg)
    d = f'M {ox1:.1f} {oy1:.1f} A {r_out} {r_out} 0 {large} 1 {ox2:.1f} {oy2:.1f} L {ix1:.1f} {iy1:.1f} A {r_in} {r_in} 0 {large} 0 {ix2:.1f} {iy2:.1f} Z'
    return d

print("ViewBox: 0 0", w, h)
print()
print("Links (112-128):")
print(arc_path(cx, cy, r_inner, r_outer, 112, 128))
print()
print("Mitte (80-100):")
print(arc_path(cx, cy, r_inner, r_outer, 80, 100))
print()
print("Rechts (52-68):")
print(arc_path(cx, cy, r_inner, r_outer, 52, 68))
