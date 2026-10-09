import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const target = 'src/data/questionBank.ts';
const transcript = '../.transcripts/019ff972-18f5-7403-90ba-3ff19e8eebdc_general_agent.jsonl';

function loadBank(source) {
  const marker = 'export const questionBank';
  const start = source.indexOf('[', source.indexOf(marker));
  const terminator = source.includes('\n] as const;') ? '\n] as const;' : '\n];';
  const end = source.indexOf(terminator, start);
  if (start < 0 || end < 0) throw new Error('未能定位題庫陣列。');
  const normalized = `globalThis.questionBank = ${source.slice(start, end + 2)};`;
  const context = {};
  vm.createContext(context);
  vm.runInContext(normalized, context);
  return context.questionBank;
}

const current = fs.readFileSync(target, 'utf8');
const currentBank = loadBank(current);
if (currentBank.length !== 600 || currentBank.some((q, i) => q.number !== i + 1)) {
  throw new Error('現有 Q1–600 並非連續完整；停止還原。');
}

const gitSource = execFileSync(
  'git',
  ['show', '1c5465d909c014c6850f04b091410e61e39ef90c:src/data/questionBank.ts'],
  { encoding: 'utf8' },
);
const helperByNumber = new Map(loadBank(gitSource).map((q) => [q.number, q]));
const lines = fs.readFileSync(transcript, 'utf8').trimEnd().split(/\r?\n/);
const userContent = JSON.parse(lines[3786]).content;
const rawByNumber = new Map();
for (const raw of userContent.split(/\r?\n/)) {
  const match = /^(\d+),模塊3,/.exec(raw);
  if (!match) continue;
  const number = Number(match[1]);
  if (number >= 601 && number <= 665) rawByNumber.set(number, raw);
}
if (rawByNumber.size !== 65 || [...rawByNumber.keys()].some((number, index) => number !== 601 + index)) {
  throw new Error(`未取得連續 Q601–665 的 65 個原始資料列（取得 ${rawByNumber.size} 個）；停止還原。`);
}

const rankMap = [
  ['警署警長', 'SS'],
  ['總督察', 'CIP'],
  ['總警司', 'CSP'],
  ['警長', 'SG'],
  ['督察', 'IP'],
  ['警司', 'SP'],
];
const abbreviateRanks = (value) => rankMap.reduce((text, [from, to]) => text.split(from).join(to), value);
const additions = [];

for (let number = 601; number <= 665; number += 1) {
  const raw = rawByNumber.get(number);
  const helper = helperByNumber.get(number);
  if (!helper || helper.options.length !== 4) throw new Error(`Git 結構輔助無法確認 Q${number} 的四選項結構；停止還原。`);

  // 使用者原文未以引號包裹千位數逗號；只保護「數字,三位數字」這種可機械判定的千位分隔符，再切分欄位。
  const protectedRaw = raw.replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1\uE000');
  const columns = protectedRaw.split(',').map((value) => value.replace(/\uE000/g, ','));
  if (columns.length !== 9 || columns[0] !== String(number) || columns[1] !== '模塊3') {
    throw new Error(`Q${number} 無法精確分為 9 欄；停止還原。`);
  }
  const [, , stem, optionA, optionB, optionC, optionD, answer, explanation] = columns;
  if (!/^[A-D]$/.test(answer)) throw new Error(`Q${number} 答案欄不是 A–D；停止還原。`);
  if (columns.join(',') !== raw) throw new Error(`Q${number} 重新組合後與原文不一致；停止還原。`);

  additions.push({
    id: `module3-part1-${number}`,
    number,
    chapter: 'law',
    type: 'Part 1 · 模塊3',
    stem: abbreviateRanks(stem),
    options: [
      ['A', abbreviateRanks(optionA)],
      ['B', abbreviateRanks(optionB)],
      ['C', abbreviateRanks(optionC)],
      ['D', abbreviateRanks(optionD)],
    ],
    answer,
    explanation: abbreviateRanks(explanation),
    reference: '使用者直接提供的模塊3 CSV – Part 1（551–665）；僅供個人學習參考，不代表警務處官方立場。',
  });
}

const terminator = '\n] as const;';
const terminatorIndex = current.indexOf(terminator);
if (terminatorIndex < 0) throw new Error('找不到題庫陣列結束位置；停止還原。');
const rendered = additions
  .map((question) => JSON.stringify(question, null, 2).split('\n').map((line) => `  ${line}`).join('\n'))
  .join(',\n');
const output = `${current.slice(0, terminatorIndex).replace(/\s*$/, '')},\n${rendered}${current.slice(terminatorIndex)}`;
fs.writeFileSync(target, output, 'utf8');
console.log(JSON.stringify({ restored: additions.length, first: additions[0], last: additions.at(-1) }, null, 2));
