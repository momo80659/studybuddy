import fs from "node:fs";
import assert from "node:assert/strict";

const source = "src/data/questionBank.ts";
const backup = "src/data/questionBank.before-q316-q500-reference.ts";
const marker = "待核實追溯：原始題庫未附獨立參考欄；請按題幹所涉法例／PGO／程序及現行生效版本核對。";
const targetStart = 316;
const targetEnd = 500;

function matchingBrace(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index + 1;
  }
  throw new Error(`未能找到物件結尾：位置 ${start}`);
}

function questionObjects(text) {
  const startPattern = /(^|\n)  \{\n    "id": "question-\d+",/g;
  const rows = new Map();
  for (const match of text.matchAll(startPattern)) {
    const start = match.index + match[1].length;
    const end = matchingBrace(text, start);
    const raw = text.slice(start, end);
    const numberMatch = raw.match(/\n    "number": (\d+),/);
    assert.ok(numberMatch, "題目物件缺少 number");
    const number = Number(numberMatch[1]);
    assert.ok(!rows.has(number), `Q${number} 重複出現`);
    rows.set(number, raw);
  }
  return rows;
}

function reference(raw) {
  const match = raw.match(/\n    "reference": ("(?:\\.|[^"\\])*")/);
  return match ? JSON.parse(match[1]) : null;
}

const beforeText = fs.readFileSync(backup, "utf8");
const afterText = fs.readFileSync(source, "utf8");
const newline = beforeText.includes("\r\n") ? "\r\n" : "\n";
const before = questionObjects(beforeText);
const after = questionObjects(afterText);
assert.equal(after.size, before.size, "題目總數不可改變");

const updated = [];
let expectedText = beforeText;
for (const [number, beforeRaw] of before) {
  const afterRaw = after.get(number);
  assert.ok(afterRaw, `Q${number} 不可刪除`);
  const beforeReference = reference(beforeRaw);
  const afterReference = reference(afterRaw);
  const inTarget = number >= targetStart && number <= targetEnd;
  const wasMissing = beforeReference === null || beforeReference.trim() === "";

  if (inTarget && wasMissing) {
    assert.equal(afterReference, marker, `Q${number} 必須補上指定待核實 reference`);
    const expected = beforeRaw.replace(
      /"reference": ("(?:\\.|[^"\\])*")/,
      `"reference": ${JSON.stringify(marker)}`,
    );
    assert.equal(afterRaw, expected, `Q${number} 除 reference 值外不得改變任何字元`);
    expectedText = expectedText.replace(beforeRaw, expected);
    updated.push(number);
  } else {
    assert.equal(afterRaw, beforeRaw, `Q${number} 不在允許改動範圍內`);
  }
}

assert.equal(afterText, expectedText, "整份題庫只可替換 Q316–Q500 的指定 reference 值");
assert.equal(updated.length, 140, "應只補齊原先缺失 reference 的 140 題");
assert.ok(updated.every((number) => number >= targetStart && number <= targetEnd), "所有新增 reference 必須在 Q316–Q500 內");

console.log(`通過：題目總數 ${after.size} 題未變；僅 Q316–Q500 內 ${updated.length} 題由缺失 reference 補為指定待核實標記。`);
console.log(`補齊題號：${updated.join(", ")}`);
