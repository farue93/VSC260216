from PIL import Image
import numpy as np

files = [
    '13459_OCTRION_Bildmarke_RGB_lila.png',
    'letter_c.png', 'letter_t.png', 'letter_r.png',
    'letter_i.png', 'letter_o2.png', 'letter_n.png',
    'ctrion_text.png'
]
target = (76, 48, 168)  # #4c30a8

for f in files:
    img = Image.open(f).convert('RGBA')
    a = np.array(img, dtype=np.float64)
    mask = a[:,:,3] > 10
    if mask.any():
        new_a = a.copy()
        new_a[mask, 0] = target[0]
        new_a[mask, 1] = target[1]
        new_a[mask, 2] = target[2]
        Image.fromarray(new_a.astype(np.uint8)).save(f)
        print(f'{f}: recolored to #4c30a8')
