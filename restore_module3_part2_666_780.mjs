import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, 'src/data/questionBank.ts');
const backup = path.join(here, 'src/data/questionBank.ts.backup-before-module3-part2-666-780-20260817T000000');
if (!existsSync(backup)) throw new Error(`找不到備份：${path.basename(backup)}`);
const current = readFileSync(target, 'utf8');
if (!current.includes('"id": "module3-part2-666"')) throw new Error('目前題庫不含 Q666–780；拒絕以舊備份覆蓋');
if (current.includes('"id": "module3-part2-781"')) throw new Error('偵測到目標外的後續題目；拒絕覆蓋');
writeFileSync(target, readFileSync(backup, 'utf8'), 'utf8');
console.log(`RESTORED: ${path.basename(target)} <= ${path.basename(backup)}`);
