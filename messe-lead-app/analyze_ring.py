"""
Analyse der OCTRION Bildmarke: Wo sind die lila Ring-Segmente?
Scannt entlang des Rings in Grad-Schritten und misst, ob dort lila oder weiß ist.
"""
from PIL import Image
import numpy as np
import math

img = Image.open(r"c:\Users\Fabi\Desktop\VSC260216\messe-lead-app\13459_OCTRION_Bildmarke_RGB_lila.png").convert("RGBA")
px = np.array(img)
h, w = px.shape[:2]

# 1) Content bounds finden (nicht-transparente Pixel)
alpha = px[:,:,3]
rows = np.any(alpha > 20, axis=1)
cols = np.any(alpha > 20, axis=0)
y_min, y_max = np.where(rows)[0][[0,-1]]
x_min, x_max = np.where(cols)[0][[0,-1]]

content_w = x_max - x_min + 1
content_h = y_max - y_min + 1
cx = (x_min + x_max) / 2  # Zentrum
cy = (y_min + y_max) / 2

print(f"Image: {w}x{h}")
print(f"Content bounds: x={x_min}-{x_max}, y={y_min}-{y_max} ({content_w}x{content_h})")
print(f"Center: ({cx:.0f}, {cy:.0f})")
print()

# 2) Ring-Radius schätzen: Mittlerer Radius des Rings
# Scanne vom Zentrum nach außen in verschiedene Richtungen
def is_purple(r, g, b, a):
    """Ist das Pixel lila? (nicht weiß/transparent)"""
    if a < 30:
        return False
    # Lila: hoher Blau-Anteil, mittlerer Rot-Anteil, niedriger Grün-Anteil
    # Oder einfach: nicht fast-weiß und nicht transparent
    brightness = (int(r) + int(g) + int(b)) / 3
    if brightness > 240:  # fast weiß
        return False
    return True

# Finde Ring-Innenradius und Außenradius bei 0° (rechts)
def find_ring_at_angle(angle_deg):
    """Scannt vom Zentrum nach außen bei gegebenem Winkel. 
    Gibt (inner_r, outer_r) des Rings zurück, oder None."""
    angle_rad = math.radians(angle_deg)
    max_r = max(content_w, content_h)
    
    in_ring = False
    inner_r = None
    outer_r = None
    
    for r in range(0, max_r):
        x = int(cx + r * math.cos(angle_rad))
        y = int(cy + r * math.sin(angle_rad))
        if x < 0 or x >= w or y < 0 or y >= h:
            break
        
        p = px[y, x]
        purple = is_purple(p[0], p[1], p[2], p[3])
        
        if purple and not in_ring:
            in_ring = True
            inner_r = r
        elif not purple and in_ring:
            outer_r = r - 1
            break
    
    if in_ring and outer_r is None:
        outer_r = inner_r  # nur 1px breit
    
    return (inner_r, outer_r) if inner_r is not None else None

# 3) Scanne alle 1° rund um den Ring
print("=== RING-SCAN: Lila-Bereiche pro Grad ===")
print("(0° = rechts, 90° = unten, 180° = links, 270° = oben)")
print()

results = []
for deg in range(0, 360):
    ring = find_ring_at_angle(deg)
    if ring:
        results.append((deg, ring[0], ring[1], True))
    else:
        results.append((deg, 0, 0, False))

# 4) Finde die Übergänge: lila → weiß und weiß → lila
print("=== ÜBERGÄNGE LILA ↔ WEISS ===")
transitions = []
for i in range(len(results)):
    curr = results[i][3]
    prev = results[i-1][3]
    if curr != prev:
        kind = "LILA START" if curr else "LILA ENDE"
        transitions.append((results[i][0], kind))
        print(f"  {results[i][0]:3d}° → {kind}")

print()

# 5) Ring-Segmente identifizieren
print("=== LILA RING-SEGMENTE ===")
segments = []
start = None
for deg, inner_r, outer_r, has_purple in results:
    if has_purple and start is None:
        start = deg
    elif not has_purple and start is not None:
        segments.append((start, deg - 1))
        start = None
if start is not None:
    # Wrap-around: check if segment started before 360° continues into 0°
    if results[0][3]:
        # Verbinde mit erstem Segment
        segments.append((start, 359))
    else:
        segments.append((start, 359))

# Check for wrap-around
if len(segments) >= 2 and segments[-1][1] == 359 and segments[0][0] == 0:
    # Merge first and last
    merged_start = segments[-1][0]
    merged_end = segments[0][1]
    segments = segments[1:-1]
    segments.insert(0, (merged_start, merged_end))
    print("  (Wrap-around Segment erkannt)")

for i, (s, e) in enumerate(segments):
    span = (e - s + 1) if e >= s else (360 - s + e + 1)
    mid = s + span // 2
    if mid >= 360: mid -= 360
    print(f"  Segment {i+1}: {s}° bis {e}° (Spannweite: {span}°, Mitte: {mid}°)")

print()

# 6) Ring-Dimensionen (gemittelt)
ring_inner_rs = [r[1] for r in results if r[3]]
ring_outer_rs = [r[2] for r in results if r[3]]
avg_inner = np.mean(ring_inner_rs) if ring_inner_rs else 0
avg_outer = np.mean(ring_outer_rs) if ring_outer_rs else 0
avg_mid = (avg_inner + avg_outer) / 2
ring_width = avg_outer - avg_inner

print(f"=== RING-DIMENSIONEN ===")
print(f"  Innenradius (Mittel): {avg_inner:.0f}px")
print(f"  Außenradius (Mittel): {avg_outer:.0f}px")
print(f"  Ringbreite: {ring_width:.0f}px")
print(f"  Mittlerer Radius: {avg_mid:.0f}px")
print()

# 7) Prozentuale Positionen für CSS
print("=== CSS-WERTE (relativ zum Content-Bereich) ===")
for i, (s, e) in enumerate(segments):
    span = (e - s + 1) if e >= s else (360 - s + e + 1)
    mid_deg = s + span // 2
    if mid_deg >= 360: mid_deg -= 360
    mid_rad = math.radians(mid_deg)
    
    # Mittelpunkt des Segments auf dem Ring
    x_pct = 50 + (avg_mid * math.cos(mid_rad)) / content_w * 100
    y_pct = 50 + (avg_mid * math.sin(mid_rad)) / content_h * 100
    
    print(f"  Segment {i+1} (Mitte {mid_deg}°): x={x_pct:.1f}%, y={y_pct:.1f}% (von content)")
    print(f"    → CSS: left: {x_pct:.1f}%; top: {y_pct:.1f}%;")
