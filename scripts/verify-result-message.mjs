/** created by: Christian Stelmach (chrisp.stel@gmail.com) */
// node --import tsx scripts/verify-result-message.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compiled = ts.transpileModule(readFileSync(new URL('../src/survey/surveyResultModal.ts', import.meta.url), 'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const concisePainMessage = new Function('exports', compiled + '; return concisePainMessage;')({});
assert.equal(concisePainMessage('One. Two! Three? Four.'), 'One. Two! Three?');
assert.equal(concisePainMessage('Only one sentence.'), 'Only one sentence.');
assert.equal(concisePainMessage('First. Second.'), 'First. Second.');
assert.equal(concisePainMessage('  '), '');
console.log('Result message keeps at most three complete sentences PASS');
