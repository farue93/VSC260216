from PIL import Image
import numpy as np

img = Image.open('13459_OCTRION_GROUP_Logo_RGB_lila.png').convert('RGBA')
a = np.array(img)
alpha = a[:,:,3]

# Find rows with content
row_has = np.any(alpha > 20, axis=1)
rows = np.where(row_has)[0]
print(f'Image: {img.size[0]}x{img.size[1]}')
print(f'Content rows: {rows[0]} - {rows[-1]}')

# Find text lines by row gaps
prev = rows[0]
segments = [[rows[0]]]
for r in rows[1:]:
    if r - prev > 30:
        segments[-1].append(prev)
        segments.append([r])
    prev = r
segments[-1].append(rows[-1])

for i, (start, end) in enumerate(segments):
    print(f'Line {i}: rows {start}-{end} (h={end-start+1})')

# First line = OCTRION
line_top, line_bot = segments[0]
line_alpha = alpha[line_top:line_bot+1, :]
col_has = np.any(line_alpha > 20, axis=0)
cols = np.where(col_has)[0]

# Column segments = individual letters
prev = cols[0]
col_segs = [[cols[0]]]
for c in cols[1:]:
    if c - prev > 15:
        col_segs[-1].append(prev)
        col_segs.append([c])
    prev = c
col_segs[-1].append(cols[-1])

names = ['O-Bild','C','T','R','I','O2','N']
letter_data = []
for i, (start, end) in enumerate(col_segs):
    seg_alpha = alpha[:, start:end+1]
    seg_rows = np.where(np.any(seg_alpha > 20, axis=1))[0]
    name = names[i] if i < len(names) else f'Seg{i}'
    print(f'{name}: cols {start}-{end} (w={end-start+1}), rows {seg_rows[0]}-{seg_rows[-1]} (h={seg_rows[-1]-seg_rows[0]+1})')
    letter_data.append({
        'name': name,
        'col_start': start, 'col_end': end,
        'row_start': seg_rows[0], 'row_end': seg_rows[-1]
    })

# Crop each letter from CTRION (skip first O = Bildmarke)
# Use the overall top/bottom of the text line for uniform height
text_letters = letter_data[1:]  # C, T, R, I, O2, N
# Use consistent vertical crop: min row_start to max row_end of all text letters
text_top = min(l['row_start'] for l in text_letters)
text_bot = max(l['row_end'] for l in text_letters)
print(f'\nText vertical extent: rows {text_top}-{text_bot} (h={text_bot-text_top+1})')
print(f'Bildmarke vertical: rows {letter_data[0]["row_start"]}-{letter_data[0]["row_end"]}')

# Add padding around each letter crop (2px each side)
pad = 2
for ld in text_letters:
    name = ld['name']
    left = ld['col_start'] - pad
    right = ld['col_end'] + pad + 1
    top = text_top - pad
    bottom = text_bot + pad + 1
    crop = img.crop((left, top, right, bottom))
    fname = f'letter_{name.lower()}.png'
    crop.save(fname)
    print(f'Saved {fname}: {crop.size[0]}x{crop.size[1]}')

# Also crop the full CTRION text as one image (for header)
ctrion_left = text_letters[0]['col_start'] - pad
ctrion_right = text_letters[-1]['col_end'] + pad + 1
ctrion_top = text_top - pad
ctrion_bottom = text_bot + pad + 1
ctrion = img.crop((ctrion_left, ctrion_top, ctrion_right, ctrion_bottom))
ctrion.save('ctrion_text.png')
print(f'Saved ctrion_text.png: {ctrion.size[0]}x{ctrion.size[1]}')

# Print proportions for CSS
print('\n--- Proportions for CSS ---')
total_w = sum(l['col_end'] - l['col_start'] + 1 for l in text_letters)
gaps = []
for i in range(1, len(text_letters)):
    gap = text_letters[i]['col_start'] - text_letters[i-1]['col_end'] - 1
    gaps.append(gap)
print(f'Gaps between CTRION letters: {gaps}')
text_h = text_bot - text_top + 1
bild_h = letter_data[0]['row_end'] - letter_data[0]['row_start'] + 1
print(f'Bildmarke height: {bild_h}, Text height: {text_h}')
print(f'Bildmarke / Text height ratio: {bild_h/text_h:.3f}')

# Gap from Bildmarke O to C
gap_o_c = text_letters[0]['col_start'] - letter_data[0]['col_end'] - 1
print(f'Gap O->C: {gap_o_c}px, ratio to text height: {gap_o_c/text_h:.3f}')
