import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'src/data/questionBank.ts');
const rawCsv = path.join(path.dirname(here), 'module3_part2_666_780_user_raw.csv');
const backup = path.join(here, 'src/data/questionBank.ts.backup-before-module3-part2-666-780-20260817T000000');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function abbreviate(value) {
  // 長詞必須優先，避免「警署警長」先被縮成「警署SG」。
  return value
    .replaceAll('警署警長', 'SS')
    .replaceAll('總督察', 'CIP')
    .replaceAll('總警司', 'CSP')
    .replaceAll('警長', 'SG')
    .replaceAll('督察', 'IP')
    .replaceAll('警司', 'SP');
}

function parseLine(line) {
  // CSV 沒有為千位逗號加引號；只把數字千位分隔符暫時遮罩，其他逗號仍視作欄位界線。
  const marker = '\u0000THOUSAND\u0000';
  const protectedLine = line.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, marker);
  const cells = protectedLine.split(',').map((cell) => cell.replaceAll(marker, ','));
  if (cells.length !== 9) throw new Error(`題號 ${cells[0] ?? '?'}：無法保守解析為九欄（得到 ${cells.length} 欄）`);
  const [numberText, moduleName, stem, optA, optB, optC, optD, answer, explanation] = cells;
  const number = Number(numberText);
  if (!Number.isInteger(number) || number < 666 || number > 780) throw new Error(`題號 ${numberText} 不在 666–780 範圍內`);
  if (moduleName !== '模塊3') throw new Error(`題號 ${number}：模塊欄不是「模塊3」`);
  if (!/^[A-D]$/.test(answer)) throw new Error(`題號 ${number}：答案不是 A–D`);
  if ([stem, optA, optB, optC, optD, explanation].some((cell) => cell.length === 0)) throw new Error(`題號 ${number}：有空白必填欄位`);
  return { number, stem, options: [optA, optB, optC, optD], answer, explanation };
}

const raw = readFileSync(rawCsv, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const records = raw.split('\n').map(parseLine);
const numbers = records.map(({ number }) => number);
if (records.length !== 115 || new Set(numbers).size !== 115 || numbers.some((n, i) => n !== 666 + i)) {
  throw new Error('原始CSV未能形成連續且唯一的 Q666–780 共115題');
}

let source = readFileSync(target, 'utf8');
if (/"number": (?:66[6-9]|6[7-9]\d|7[0-7]\d|780),/.test(source)) {
  throw new Error('題庫已包含 Q666–780 的至少一題；拒絕重複匯入');
}
if (!/"number": 665,/.test(source)) throw new Error('未找到 Q665 邊界，拒絕插入');
const marker = '\n] as const;';
const markerIndex = source.lastIndexOf(marker);
if (markerIndex < 0) throw new Error('未找到 questionBank 陣列結尾，拒絕插入');
const prior = source.slice(0, markerIndex);
if (!prior.includes('"id": "module3-part1-665"')) throw new Error('Q665 並非最後匯入邊界，拒絕插入');

if (existsSync(backup)) throw new Error(`備份已存在：${path.basename(backup)}；拒絕覆寫`);
copyFileSync(target, backup);
const entryText = records.map((record) => {
  const stem = abbreviate(record.stem);
  const options = record.options.map(abbreviate);
  const explanation = abbreviate(record.explanation);
  return `  {\n    "id": "module3-part2-${record.number}",\n    "number": ${record.number},\n    "chapter": "law",\n    "type": "Part 2 · 模塊3",\n    "stem": ${JSON.stringify(stem)},\n    "options": [\n${options.map((option, index) => `      [\n        "${String.fromCharCode(65 + index)}",\n        ${JSON.stringify(option)}\n      ]`).join(',\n')}\n    ],\n    "answer": "${record.answer}",\n    "explanation": ${JSON.stringify(explanation)},\n    "reference": "使用者直接提供的模塊3 CSV – Part 2（666–780）；僅供個人學習參考，不代表警務處官方立場。"\n  }`;
}).join(',\n');
const next = `${prior},\n${entryText}${source.slice(markerIndex)}`;
writeFileSync(target, next, 'utf8');
const manifest = {
  source: path.relative(here, rawCsv),
  sourceSha256: sha256(raw),
  backup: path.basename(backup),
  backupSha256: sha256(readFileSync(backup, 'utf8')),
  prefixBeforeInsertionSha256: sha256(prior),
  importedNumbers: [666, 780],
  count: records.length,
  abbreviationMap: { '警署警長': 'SS', '總督察': 'CIP', '總警司': 'CSP', '警長': 'SG', '督察': 'IP', '警司': 'SP' },
};
writeFileSync(path.join(here, 'module3_part2_666_780_import_manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(manifest, null, 2));
