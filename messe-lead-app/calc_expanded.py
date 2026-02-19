import math
cx,cy=896.0,844.0; w,h=1792,1688
crop_x1=w/3; crop_y1=h/3; crop_w=w/3; crop_h=h/3
def pt(a,r):
    return cx+r*math.cos(math.radians(a)), cy+r*math.sin(math.radians(a))
# Current outer radii: 290, 282, 290. Increase by 50%:
# 290*1.5=435, 282*1.5=423. Inner stays same.
segs=[
  ("Left","solutions",111.50,128.00,188,435),
  ("Center","showcase",79.50,100.75,192,423),
  ("Right","contact",52.25,68.75,188,435),
]
for name,sec,a1,a2,ri,ro in segs:
    ox1,oy1=pt(a1,ro); ox2,oy2=pt(a2,ro)
    ix1,iy1=pt(a2,ri); ix2,iy2=pt(a1,ri)
    d=f"M {ox1:.1f} {oy1:.1f} A {ro} {ro} 0 0 1 {ox2:.1f} {oy2:.1f} L {ix1:.1f} {iy1:.1f} A {ri} {ri} 0 0 0 {ix2:.1f} {iy2:.1f} Z"
    mid=(a1+a2)/2; tr=ri-25
    tx,ty=pt(mid,tr); tl=(tx-crop_x1)/crop_w*100; tt=(ty-crop_y1)/crop_h*100
    print(f"{name} ({sec}):")
    print(f'  d="{d}"')
    print(f"  tooltip: left={tl:.1f}% top={tt:.1f}%")
    print()
