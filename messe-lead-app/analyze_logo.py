from PIL import Image
import numpy as np

img = Image.open('13459_OCTRION_GROUP_Logo_RGB_lila.png')
arr = np.array(img)
alpha = arr[:,:,3]
rows = np.any(alpha > 10, axis=1)
cols = np.any(alpha > 10, axis=0)
rmin, rmax = np.where(rows)[0][[0,-1]]
cmin, cmax = np.where(cols)[0][[0,-1]]
content_w = cmax - cmin + 1
content_h = rmax - rmin + 1
print("GROUP content: %dw x %dh" % (content_w, content_h))

# Find where Bildmarke ends (first vertical gap)
bildmarke_end = cmin
for c in range(cmin, cmax):
    col_has = np.any(alpha[rmin:rmax+1, c] > 10)
    if not col_has:
        bildmarke_end = c
        break

bildmarke_w = bildmarke_end - cmin
print("Bildmarke width in GROUP: %d px" % bildmarke_w)
print("Text (CTRION) width: %d px" % (cmax - bildmarke_end))
print("Bildmarke/total ratio: %.3f" % (bildmarke_w / content_w))
print("Bildmarke height / content height: %.3f" % (content_h / content_h))

# Find where text starts after gap
text_start = bildmarke_end
for c in range(bildmarke_end, cmax):
    col_has = np.any(alpha[rmin:rmax+1, c] > 10)
    if col_has:
        text_start = c
        break

gap = text_start - bildmarke_end
print("Gap between O and CTRION: %d px" % gap)
print("Gap ratio of total: %.3f" % (gap / content_w))

# Find text height (the CTRION letters are shorter than the full logo)
text_rows = np.any(alpha[:, text_start:cmax+1] > 10, axis=1)
tr_min, tr_max = np.where(text_rows)[0][[0,-1]]
text_h = tr_max - tr_min + 1
print("Text height: %d px" % text_h)
print("Logo height: %d px" % content_h)
print("Text-to-logo height ratio: %.3f" % (text_h / content_h))

# Text vertical center offset
text_center = (tr_min + tr_max) / 2
logo_center = (rmin + rmax) / 2
print("Text center Y: %.0f, Logo center Y: %.0f" % (text_center, logo_center))
print("Text is offset from logo center by: %.0f px" % (text_center - logo_center))

# Bildmarke standalone
img3 = Image.open('13459_OCTRION_Bildmarke_RGB_lila.png')
arr3 = np.array(img3)
alpha3 = arr3[:,:,3]
rows3 = np.any(alpha3 > 10, axis=1)
cols3 = np.any(alpha3 > 10, axis=0)
r3min, r3max = np.where(rows3)[0][[0,-1]]
c3min, c3max = np.where(cols3)[0][[0,-1]]
bm_w = c3max - c3min + 1
bm_h = r3max - r3min + 1
print("Bildmarke standalone: %dw x %dh, aspect: %.3f" % (bm_w, bm_h, bm_w/bm_h))
