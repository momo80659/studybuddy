import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const bankPath = path.join(projectRoot, "src/data/questionBank.ts");
const appPath = path.join(projectRoot, "src/App.tsx");
const outputPath = path.join(projectRoot, "questionBank_full_validation.json");

const REQUIRED_KEYS = ["id", "number", "chapter", "type", "stem", "options", "answer", "explanation", "reference"];
const CANONICAL_STEM_KEY = "stem";
const EXPECTED_891_1000 = { idPrefix: "module4-part2-", chapter: "supervision", type: "Part 2 · 模塊4", answer: "B" };
const BANNED_RANK_TERMS = ["警署警長", "總督察", "總警司", "警長", "督察", "警司"];

function locationAt(text, offset) {
  const prefix = text.slice(0, offset);
  return { offset, line: prefix.split("\n").length, column: offset - prefix.lastIndexOf("\n") };
}

function scanTopLevelObjects(source) {
  const start = source.indexOf("export const questionBank");
  if (start < 0) throw new Error("找不到 questionBank 匯出。");
  const arrayStart = source.indexOf("[", start);
  if (arrayStart < 0) throw new Error("找不到 questionBank 陣列開頭。");
  const objects = [];
  const syntaxIssues = [];
  let inString = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let depth = 0;
  let objectStart = -1;
  let arrayClosed = false;

  for (let i = arrayStart + 1; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; i += 1; }
      continue;
    }
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if (ch === "{") {
      if (depth === 0) objectStart = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth < 0) {
        syntaxIssues.push({ kind: "unmatched_closing_brace", ...locationAt(source, i) });
        depth = 0;
      }
      if (depth === 0 && objectStart >= 0) {
        objects.push({ start: objectStart, end: i + 1, raw: source.slice(objectStart, i + 1) });
        objectStart = -1;
      }
      continue;
    }
    if (ch === "]" && depth === 0) { arrayClosed = true; break; }
  }
  if (!arrayClosed) syntaxIssues.push({ kind: "unclosed_questionBank_array", ...locationAt(source, arrayStart) });
  if (depth !== 0 || objectStart >= 0) syntaxIssues.push({ kind: "unclosed_object", ...locationAt(source, objectStart >= 0 ? objectStart : arrayStart) });
  return { objects, syntaxIssues };
}

function stripStringsAndComments(text) {
  let result = "";
  let inString = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (lineComment) {
      if (ch === "\n") { lineComment = false; result += "\n"; } else result += " ";
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") { blockComment = false; result += "  "; i += 1; } else result += ch === "\n" ? "\n" : " ";
      continue;
    }
    if (inString) {
      result += ch === "\n" ? "\n" : " ";
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; result += "  "; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; result += "  "; i += 1; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; result += " "; continue; }
    result += ch;
  }
  return result;
}

function findTopLevelKeys(raw) {
  const keys = [];
  let inString = null;
  let escaped = false;
  let depth = 0;
  let expectingKey = false;
  let keyStart = -1;
  let keyQuote = null;
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === inString) {
        if (keyQuote && depth === 1) {
          const after = raw.slice(i + 1).match(/^\s*:/);
          if (after) keys.push(raw.slice(keyStart, i + 1));
        }
        inString = null; keyQuote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = ch;
      if (depth === 1) { keyStart = i; keyQuote = ch; }
      continue;
    }
    if (ch === "{") { depth += 1; expectingKey = depth === 1; continue; }
    if (ch === "}") { depth -= 1; continue; }
    if (depth === 1 && (ch === ",")) { expectingKey = true; continue; }
    if (depth === 1 && /[A-Za-z_$]/.test(ch) && expectingKey) {
      const match = raw.slice(i).match(/^([A-Za-z_$][\w$]*)\s*:/);
      if (match) { keys.push(match[1]); expectingKey = false; i += match[1].length - 1; }
    }
    if (depth === 1 && ch === ":") expectingKey = false;
  }
  return keys.map((key) => key.replace(/^['"]|['"]$/g, ""));
}

function parseObject(raw) {
  try {
    return { value: JSON.parse(raw), parseError: null };
  } catch (error) {
    return { value: null, parseError: String(error.message) };
  }
}

function addCheck(checks, id, passed, details, severity = "error") {
  checks.push({ id, passed, severity, details });
}

const bankSource = fs.readFileSync(bankPath, "utf8");
const appSource = fs.readFileSync(appPath, "utf8");
const { objects: objectRecords, syntaxIssues } = scanTopLevelObjects(bankSource);
const parseFailures = [];
const duplicateKeyIssues = [];
const records = [];

for (let index = 0; index < objectRecords.length; index += 1) {
  const record = objectRecords[index];
  const { value, parseError } = parseObject(record.raw);
  const keys = findTopLevelKeys(record.raw);
  const duplicateKeys = [...new Set(keys.filter((key, keyIndex) => keys.indexOf(key) !== keyIndex))];
  if (duplicateKeys.length) duplicateKeyIssues.push({ objectIndex: index + 1, duplicateKeys, ...locationAt(bankSource, record.start) });
  if (parseError) parseFailures.push({ objectIndex: index + 1, error: parseError, ...locationAt(bankSource, record.start) });
  if (value) records.push({ ...value, __objectIndex: index + 1, __location: locationAt(bankSource, record.start) });
}

const checks = [];
addCheck(checks, "parser.object_extraction", objectRecords.length === 1000 && syntaxIssues.length === 0, {
  extractedObjectCount: objectRecords.length,
  syntaxIssues,
  note: "採字串／註解感知的花括號掃描逐題抽取，故舊資料如出現物件之間的多餘逗號不會令整庫驗證中止。",
});
addCheck(checks, "parser.object_parse", parseFailures.length === 0, { parseFailureCount: parseFailures.length, parseFailures });
addCheck(checks, "keys.duplicate", duplicateKeyIssues.length === 0, { duplicateKeyIssueCount: duplicateKeyIssues.length, duplicateKeyIssues });

const numbers = records.map((record) => record.number);
const numberFrequency = new Map();
for (const number of numbers) numberFrequency.set(number, (numberFrequency.get(number) ?? 0) + 1);
const duplicateNumbers = [...numberFrequency.entries()].filter(([, count]) => count > 1).map(([number, count]) => ({ number, count }));
const invalidNumbers = records.filter((record) => !Number.isInteger(record.number) || record.number < 1 || record.number > 1000).map((record) => ({ id: record.id, number: record.number, location: record.__location }));
const missingNumbers = Array.from({ length: 1000 }, (_, index) => index + 1).filter((number) => !numberFrequency.has(number));
addCheck(checks, "bank.count", records.length === 1000, { expected: 1000, actual: records.length });
addCheck(checks, "number.continuous_unique", records.length === 1000 && duplicateNumbers.length === 0 && invalidNumbers.length === 0 && missingNumbers.length === 0, { expectedRange: "Q1–Q1000", duplicateNumbers, invalidNumbers, missingNumbers });

const chapterCounts = {};
const invalidChapterRecords = [];
for (const record of records) {
  const chapter = typeof record.chapter === "string" ? record.chapter.trim() : "";
  if (!chapter) invalidChapterRecords.push({ id: record.id, number: record.number, chapter: record.chapter });
  else chapterCounts[chapter] = (chapterCounts[chapter] ?? 0) + 1;
}
addCheck(checks, "chapter.distribution_report", invalidChapterRecords.length === 0, {
  actual: chapterCounts,
  totalAcrossChapters: Object.values(chapterCounts).reduce((sum, count) => sum + count, 0),
  invalidChapterRecords,
  note: "依使用者已確認標準，保留題庫現有 chapter 歸類；本項僅報告實際分布，不以預設配額作失敗判定。",
});

const idFrequency = new Map();
for (const record of records) idFrequency.set(record.id, (idFrequency.get(record.id) ?? 0) + 1);
const duplicateIds = [...idFrequency.entries()].filter(([, count]) => count > 1).map(([id, count]) => ({ id, count }));
const missingFields = [];
const invalidOptions = [];
const invalidAnswers = [];
const missingReferenceNumbers = [];
for (const record of records) {
  const absent = REQUIRED_KEYS.filter((key) => record[key] === undefined || record[key] === null || (typeof record[key] === "string" && !record[key].trim()));
  if (absent.length) missingFields.push({ id: record.id, number: record.number, missing: absent });
  if (!(typeof record.reference === "string" && record.reference.trim())) missingReferenceNumbers.push(record.number);
  const optionLetters = Array.isArray(record.options) ? record.options.map((option) => Array.isArray(option) ? option[0] : undefined) : [];
  const optionTextOk = Array.isArray(record.options) && record.options.length === 4 && record.options.every((option) => Array.isArray(option) && option.length >= 2 && typeof option[1] === "string" && option[1].trim());
  if (!optionTextOk || optionLetters.join("") !== "ABCD") invalidOptions.push({ id: record.id, number: record.number, optionLetters, optionCount: Array.isArray(record.options) ? record.options.length : null });
  if (!/[ABCD]/.test(record.answer ?? "") || !["A", "B", "C", "D"].includes(record.answer)) invalidAnswers.push({ id: record.id, number: record.number, answer: record.answer });
}
addCheck(checks, "fields.id_unique", duplicateIds.length === 0 && records.every((record) => typeof record.id === "string" && record.id.trim()), { duplicateIds, invalidIdCount: records.filter((record) => !(typeof record.id === "string" && record.id.trim())).length });
addCheck(checks, "fields.required_schema", missingFields.length === 0, { requiredKeys: REQUIRED_KEYS, canonicalStemKey: CANONICAL_STEM_KEY, missingFieldCount: missingFields.length, missingFields });
const q316to500 = records.filter((record) => record.number >= 316 && record.number <= 500);
const q316to500MissingReferences = q316to500.filter((record) => !(typeof record.reference === "string" && record.reference.trim())).map((record) => record.number);
addCheck(checks, "fields.reference_nonempty", missingReferenceNumbers.length === 0, { missingReferenceCount: missingReferenceNumbers.length, missingReferenceNumbers, q316to500: { expectedCount: 185, actualCount: q316to500.length, missingReferenceNumbers: q316to500MissingReferences, passed: q316to500.length === 185 && q316to500MissingReferences.length === 0, note: "包含統一待核實標記在內，reference 只檢查是否存在且非空。" } });
addCheck(checks, "options.A_to_D", invalidOptions.length === 0, { invalidOptionCount: invalidOptions.length, invalidOptions });
addCheck(checks, "answer.A_to_D", invalidAnswers.length === 0, { invalidAnswerCount: invalidAnswers.length, invalidAnswers });

const q795 = records.find((record) => record.number === 795);
addCheck(checks, "special.q795_answer", q795?.answer === "C", { found: Boolean(q795), actualAnswer: q795?.answer ?? null });
const q891to1000 = records.filter((record) => record.number >= 891 && record.number <= 1000);
const q891to1000Issues = q891to1000.filter((record) => record.id !== `${EXPECTED_891_1000.idPrefix}${record.number}` || record.chapter !== EXPECTED_891_1000.chapter || record.type !== EXPECTED_891_1000.type || record.answer !== EXPECTED_891_1000.answer).map((record) => ({ number: record.number, id: record.id, chapter: record.chapter, type: record.type, answer: record.answer }));
addCheck(checks, "special.q891_to_q1000", q891to1000.length === 110 && q891to1000Issues.length === 0, { expected: { count: 110, idPattern: `${EXPECTED_891_1000.idPrefix}{number}`, chapter: EXPECTED_891_1000.chapter, type: EXPECTED_891_1000.type, answer: EXPECTED_891_1000.answer }, actualCount: q891to1000.length, issues: q891to1000Issues });

const termOccurrences = {};
for (const [file, text] of Object.entries({ questionBank: bankSource, "App.tsx": appSource })) {
  termOccurrences[file] = Object.fromEntries(BANNED_RANK_TERMS.map((term) => {
    const positions = [];
    let index = text.indexOf(term);
    while (index >= 0) { positions.push(locationAt(text, index)); index = text.indexOf(term, index + term.length); }
    return [term, positions];
  }));
}
const bannedTermHits = Object.fromEntries(Object.entries(termOccurrences).map(([file, byTerm]) => [file, Object.fromEntries(Object.entries(byTerm).filter(([, positions]) => positions.length))]));
addCheck(checks, "text.banned_rank_terms", Object.values(bannedTermHits).every((hits) => Object.keys(hits).length === 0), { terms: BANNED_RANK_TERMS, hits: bannedTermHits });

const failedChecks = checks.filter((check) => !check.passed);
const result = {
  generatedAt: new Date().toISOString(),
  scope: { bankPath: "src/data/questionBank.ts", appPath: "src/App.tsx", noSourceEditsPerformed: true },
  overall: { passed: failedChecks.length === 0, checksRun: checks.length, checksPassed: checks.length - failedChecks.length, checksFailed: failedChecks.length, failedCheckIds: failedChecks.map((check) => check.id) },
  checks,
};
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(JSON.stringify(result.overall));
if (!result.overall.passed) process.exitCode = 1;
