from PIL import Image
import numpy as np

img = Image.open('13459_OCTRION_Bildmarke_RGB_lila.png')
arr = np.array(img)
alpha = arr[:,:,3]

rows = np.any(alpha > 10, axis=1)
cols = np.any(alpha > 10, axis=0)
rmin, rmax = np.where(rows)[0][[0,-1]]
cmin, cmax = np.where(cols)[0][[0,-1]]
h = rmax - rmin + 1
w = cmax - cmin + 1
print("Content: x=%d-%d y=%d-%d (%dx%d)" % (cmin, cmax, rmin, rmax, w, h))
print("Image: %dx%d" % (img.size[0], img.size[1]))

# Scan bottom area for triangle clusters
found_rows = []
for y in range(rmin + int(h*0.5), rmax+1, 5):
    row_alpha = alpha[y, cmin:cmax+1]
    content_cols = np.where(row_alpha > 10)[0]
    if len(content_cols) == 0:
        continue
    diffs = np.diff(content_cols)
    splits = np.where(diffs > 15)[0]
    clusters = []
    start = content_cols[0]
    for s in splits:
        clusters.append((start, content_cols[s]))
        start = content_cols[s+1]
    clusters.append((start, content_cols[-1]))
    
    if len(clusters) >= 3:
        infos = []
        for i, c in enumerate(clusters):
            cx = (c[0] + c[1]) / 2.0
            cw = c[1] - c[0]
            pct_x = cx / w * 100
            pct_y = (y - rmin) / h * 100
            infos.append("  cluster%d: center_x=%.1f%% width=%dpx y=%.1f%%" % (i, pct_x, cw, pct_y))
        if len(found_rows) < 8:
            print("y=%d:" % y)
            for info in infos:
                print(info)
            found_rows.append(y)

# Also find the exact vertical range of the triangles
# Look for the row where content splits into 3 parts for the first time
print("\n=== TRIANGLE BOUNDS ===")
tri_top = None
tri_bot = None
for y in range(rmin, rmax+1):
    row_alpha = alpha[y, cmin:cmax+1]
    content_cols = np.where(row_alpha > 10)[0]
    if len(content_cols) == 0:
        continue
    diffs = np.diff(content_cols)
    splits = np.where(diffs > 15)[0]
    n_clusters = len(splits) + 1
    if n_clusters >= 3 and tri_top is None:
        tri_top = y
        print("First 3-cluster row: y=%d (%.1f%%)" % (y, (y-rmin)/h*100))
    if n_clusters >= 3:
        tri_bot = y

if tri_bot:
    print("Last 3-cluster row: y=%d (%.1f%%)" % (tri_bot, (tri_bot-rmin)/h*100))
    tri_h = tri_bot - tri_top + 1
    print("Triangle height: %dpx (%.1f%% of logo)" % (tri_h, tri_h/h*100))
