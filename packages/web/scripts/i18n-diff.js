#!/usr/bin/env node
/**
 * i18n diff — ko.json vs en.json 키 동기화 체커.
 *
 * 사용:
 *   node scripts/i18n-diff.js            # 누락 키 리포트
 *   node scripts/i18n-diff.js --fix      # en.json 에 누락 키를 ko 값 복사로 채움
 */

const fs = require('fs');
const path = require('path');

const BASE = path.resolve(__dirname, '../messages');
const koPath = path.join(BASE, 'ko.json');
const enPath = path.join(BASE, 'en.json');

const ko = JSON.parse(fs.readFileSync(koPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function flatten(obj, prefix = '') {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' || typeof v === 'number') {
      result[key] = String(v);
    } else if (Array.isArray(v)) {
      result[key] = JSON.stringify(v);
    } else if (v && typeof v === 'object') {
      Object.assign(result, flatten(v, key));
    }
  }
  return result;
}

function setDeep(obj, key, value) {
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

const koFlat = flatten(ko);
const enFlat = flatten(en);

const missingInEn = Object.keys(koFlat).filter((k) => !(k in enFlat));
const missingInKo = Object.keys(enFlat).filter((k) => !(k in koFlat));

console.log(`ko.json keys: ${Object.keys(koFlat).length}`);
console.log(`en.json keys: ${Object.keys(enFlat).length}`);
console.log(`\n❌ en.json 에 누락: ${missingInEn.length}개`);
missingInEn.forEach((k) => console.log(`  - ${k} = "${koFlat[k]}"`));
console.log(`\n❌ ko.json 에 누락: ${missingInKo.length}개`);
missingInKo.forEach((k) => console.log(`  - ${k} = "${enFlat[k]}"`));

if (process.argv.includes('--fix')) {
  let count = 0;
  for (const k of missingInEn) {
    setDeep(en, k, koFlat[k]);
    count++;
  }
  fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
  console.log(`\n✅ en.json 에 ${count}개 키 추가 (ko 값 복사). 실제 번역은 수동으로 교체하세요.`);
}
