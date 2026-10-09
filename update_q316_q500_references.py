from __future__ import annotations

import json
import re
from pathlib import Path

TARGET_START = 316
TARGET_END = 500
MARKER = "待核實追溯：原始題庫未附獨立參考欄；請按題幹所涉法例／PGO／程序及現行生效版本核對。"
SOURCE = Path("src/data/questionBank.ts")


def top_level_objects(text: str):
    array_start = text.index("[")
    i = array_start + 1
    objects = []
    while i < len(text):
        if text[i] != "{":
            i += 1
            continue
        start = i
        depth = 0
        in_string = False
        escaped = False
        while i < len(text):
            char = text[i]
            if in_string:
                if escaped:
                    escaped = False
                elif char == "\\":
                    escaped = True
                elif char == '"':
                    in_string = False
            else:
                if char == '"':
                    in_string = True
                elif char == "{":
                    depth += 1
                elif char == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        objects.append((start, end, text[start:end]))
                        i = end
                        break
            i += 1
        else:
            raise ValueError("題庫物件括號未閉合")
    return objects


def main():
    # 以 bytes 解碼保留原檔 CRLF／LF，避免非目標行產生格式差異。
    text = SOURCE.read_bytes().decode("utf-8")
    replacements = []
    updated_numbers = []
    for start, end, raw_object in top_level_objects(text):
        number_match = re.search(r'"number"\s*:\s*(\d+)', raw_object)
        if not number_match:
            continue
        number = int(number_match.group(1))
        if not TARGET_START <= number <= TARGET_END:
            continue
        reference_match = re.search(r'"reference"\s*:\s*"((?:\\.|[^"\\])*)"', raw_object)
        reference = json.loads('"' + reference_match.group(1) + '"') if reference_match else None
        if reference is None:
            property_indent = "    "
            newline = "\r\n" if "\r\n" in raw_object else "\n"
            updated = raw_object[:-1].rstrip() + ',' + newline + property_indent + '"reference": ' + json.dumps(MARKER, ensure_ascii=False) + newline + '  }'
            replacements.append((start, end, updated))
            updated_numbers.append(number)
        elif not reference.strip():
            updated = raw_object[:reference_match.start()] + '"reference": ' + json.dumps(MARKER, ensure_ascii=False) + raw_object[reference_match.end():]
            replacements.append((start, end, updated))
            updated_numbers.append(number)

    if not replacements:
        print("沒有在 Q316–Q500 找到缺失或空白的 reference；未寫入任何變更。")
        return

    result = text
    for start, end, updated in reversed(replacements):
        result = result[:start] + updated + result[end:]
    SOURCE.write_bytes(result.encode("utf-8"))
    print(f"已加入指定待核實 reference：{len(updated_numbers)} 題")
    print("題號：" + ", ".join(map(str, updated_numbers)))


if __name__ == "__main__":
    main()
