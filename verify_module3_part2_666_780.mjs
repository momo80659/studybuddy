import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'src/data/questionBank.ts');
const rawCsv = path.join(path.dirname(here), 'module3_part2_666_780_user_raw.csv');
const manifestPath = path.join(here, 'module3_part2_666_780_import_manifest.json');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function abbreviate(value) {
  return value
    .replaceAll('警署警長', 'SS')
    .replaceAll('總督察', 'CIP')
    .replaceAll('總警司', 'CSP')
    .replaceAll('警長', 'SG')
    .replaceAll('督察', 'IP')
    .replaceAll('警司', 'SP');
}

function parseLine(line) {
  const marker = '\u0000THOUSAND\u0000';
  const cells = line.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, marker).split(',').map((cell) => cell.replaceAll(marker, ','));
  if (cells.length !== 9) throw new Error(`題號 ${cells[0] ?? '?'}：無法保守解析為九欄`);
  const [numberText, moduleName, stem, optA, optB, optC, optD, answer, explanation] = cells;
  if (moduleName !== '模塊3' || !/^[A-D]$/.test(answer)) throw new Error(`題號 ${numberText}：來源欄位無效`);
  return { number: Number(numberText), stem, options: [optA, optB, optC, optD], answer, explanation };
}

const source = readFileSync(target, 'utf8');
const raw = readFileSync(rawCsv, 'utf8').replace(/\r\n/g, '\n').trimEnd();
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const expected = raw.split('\n').map(parseLine);
const startMarker = '  {\n    "id": "module3-part2-666",';
const endMarker = '\n] as const;';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('找不到已匯入的 Q666–780 段落');
const importedSegment = source.slice(start, end);
const prefix = source.slice(0, start);
// 還原為匯入前文字：只移除插入段，並把 Q665 的陣列分隔逗號還原為原結尾。
const restoredPrior = prefix.replace(/,\n$/, '') + source.slice(end);
const backupPath = path.join(here, 'src/data/questionBank.ts.backup-before-module3-part2-666-780-20260817T000000');
const backup = readFileSync(backupPath, 'utf8');
const checks = [];
checks.push({ check: '來源雜湊', pass: manifest.sourceSha256 === sha256(raw) });
checks.push({ check: '匯入前內容未變', pass: manifest.backupSha256 === sha256(restoredPrior) });
checks.push({ check: 'Q666–780 ID 數量', pass: (importedSegment.match(/"id": "module3-part2-\d+"/g) ?? []).length === 115 });
checks.push({ check: 'Q666–780 題號連續唯一', pass: expected.every((record, index) => importedSegment.includes(`"id": "module3-part2-${666 + index}"`) && record.number === 666 + index) });
checks.push({ check: 'Q1–665 無修改（還原後與備份完全一致）', pass: restoredPrior === backup && manifest.backupSha256 === sha256(backup) });
checks.push({ check: '未匯入 Q781–1000', pass: !/"id": "module3-part2-(?:78[1-9]|[89]\d\d|1000)"/.test(source) });
for (const record of expected) {
  const fields = [abbreviate(record.stem), ...record.options.map(abbreviate), abbreviate(record.explanation)];
  const id = `module3-part2-${record.number}`;
  const fragmentStart = importedSegment.indexOf(`"id": "${id}"`);
  const fragmentEnd = importedSegment.indexOf('\n  },', fragmentStart);
  const fragment = importedSegment.slice(fragmentStart, fragmentEnd < 0 ? importedSegment.length : fragmentEnd);
  if (fragmentStart < 0) throw new Error(`缺少 ${id}`);
  if (!fields.every((field) => fragment.includes(JSON.stringify(field)))) throw new Error(`題號 ${record.number}：題幹、選項或解釋與原始資料/指定縮寫不符`);
  if (!fragment.includes(`"answer": "${record.answer}"`)) throw new Error(`題號 ${record.number}：答案與原始資料不符`);
  const optionLetters = [...fragment.matchAll(/\[\n        "([A-D])",/g)].map((match) => match[1]);
  if (optionLetters.join('') !== 'ABCD') throw new Error(`題號 ${record.number}：選項不為完整 A–D`);
}
if (checks.some(({ pass }) => !pass)) throw new Error(JSON.stringify(checks, null, 2));
console.log(JSON.stringify({ result: 'PASS', questions: 115, range: '666–780', checks }, null, 2));
