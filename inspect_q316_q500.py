from pathlib import Path
import re

path = Path('src/data/questionBank.ts')
text = path.read_text(encoding='utf-8')
pattern = re.compile(r'\n\s*number:\s*(\d+),')
positions = [(int(m.group(1)), m.start()) for m in pattern.finditer(text)]
for n in (315, 316, 317, 499, 500, 501):
    start = next((pos for num, pos in positions if num == n), None)
    next_pos = next((pos for num, pos in positions if num == n + 1), len(text))
    if start is None:
        print(f'Q{n}: NOT FOUND')
    else:
        print(f'--- Q{n} ---')
        print(text[start:next_pos].strip())
        print()
