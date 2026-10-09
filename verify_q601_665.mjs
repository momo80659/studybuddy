import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('src/data/questionBank.ts', 'utf8');
const start = source.indexOf('[', source.indexOf('export const questionBank'));
const end = source.indexOf('\n] as const;', start);
if (start < 0 || end < 0) throw new Error('未能定位題庫陣列。');
const context = {};
vm.createContext(context);
vm.runInContext(`globalThis.questionBank = ${source.slice(start, end + 2)};`, context);
const bank = context.questionBank;
const restored = bank.filter((question) => question.number >= 601 && question.number <= 665);
const rankTerms = ['警署警長', '總督察', '總警司', '警長', '督察', '警司'];
const result = {
  q1to600Preserved: bank.slice(0, 600).every((question, index) => question.number === index + 1),
  restoredCount: restored.length,
  continuousUnique: restored.every((question, index) => question.number === index + 601)
    && new Set(restored.map((question) => question.number)).size === 65,
  fourOptions: restored.every((question) => question.options.length === 4
    && question.options.map(([letter]) => letter).join('') === 'ABCD'),
  answersAD: restored.every((question) => /^[A-D]$/.test(question.answer)),
  rankTermsAbsent: rankTerms.every((term) => !restored.some((question) => JSON.stringify(question).includes(term))),
  samples: [601, 602, 665].map((number) => {
    const question = restored.find((item) => item.number === number);
    return { number, stem: question.stem, answer: question.answer, explanation: question.explanation };
  }),
};
console.log(JSON.stringify(result, null, 2));
if (!result.q1to600Preserved || result.restoredCount !== 65 || !result.continuousUnique
  || !result.fourOptions || !result.answersAD || !result.rankTermsAbsent) process.exit(1);
