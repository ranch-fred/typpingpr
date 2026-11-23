// Run: node test.js
const assert = require('assert');
const C = require('./core.js');
const WORDS = require('./words.js');

// Word list: lowercase letters only, no duplicates, enough of them.
assert(WORDS.length > 500, 'word list too small: ' + WORDS.length);
for (const w of WORDS) assert(/^[a-z]+$/.test(w), 'bad word: ' + w);
for (const ch of C.LETTERS) assert(WORDS.some(w => w.includes(ch)), 'no word with ' + ch);

// WPM / accuracy.
assert.strictEqual(C.wpm(500, 60000), 100);
assert.strictEqual(C.wpm(10, 0), 0);
assert.strictEqual(C.accuracy(0, 0), 1);
assert.strictEqual(C.accuracy(9, 10), 0.9);

// Streak: today missing still counts yesterday's chain; gaps break it.
const today = new Date(2026, 10, 22);
assert.strictEqual(C.streak({ '2026-11-21': 1, '2026-11-20': 1 }, today), 2);
assert.strictEqual(C.streak({ '2026-11-22': 1, '2026-11-21': 1, '2026-11-19': 1 }, today), 2);
assert.strictEqual(C.streak({ '2026-11-01': 1 }, today), 0);
// Month boundary.
assert.strictEqual(C.streak({ '2026-12-01': 1, '2026-11-30': 1 }, new Date(2026, 11, 1)), 2);

// Key stats + weak keys: the letter with errors and slow times shows up.
const stats = {};
for (const ch of 'abcdefghij') for (let i = 0; i < 10; i++) C.recordKey(stats, ch, false, 200);
for (let i = 0; i < 10; i++) C.recordKey(stats, 'q', i % 2 === 0, 600);
for (const ch of C.LETTERS.replace(/[a-jq]/g, '')) for (let i = 0; i < 10; i++) C.recordKey(stats, ch, false, 200);
assert.strictEqual(C.weakKeys(stats, 1)[0], 'q');
assert.deepStrictEqual(C.weakKeys({}, 3), []);

// genWords: right count, no immediate repeats, focus letters dominate.
let seed = 1; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const out = C.genWords(WORDS, 300, ['z'], rng);
assert.strictEqual(out.length, 300);
for (let i = 1; i < out.length; i++) assert.notStrictEqual(out[i], out[i - 1]);
const withZ = out.filter(w => w.includes('z')).length;
assert(withZ > 150, 'focus letter too rare: ' + withZ);
assert.deepStrictEqual(C.genWords(['solo'], 3), ['solo', 'solo', 'solo']);

// Projection.
assert.strictEqual(C.projectDays([{ x: 0, y: 10 }, { x: 1, y: 11 }], 100), null);
assert.strictEqual(C.projectDays([{ x: 0, y: 10 }, { x: 1, y: 11 }, { x: 2, y: 12 }], 100), 88);
assert.strictEqual(C.projectDays([{ x: 0, y: 12 }, { x: 1, y: 11 }, { x: 2, y: 10 }], 100), null);
assert.strictEqual(C.projectDays([{ x: 0, y: 99 }, { x: 1, y: 100 }, { x: 2, y: 101 }], 100), 0);

// Levels and plan.
assert.strictEqual(C.level(10).n, 2);
assert.strictEqual(C.level(150).name, 'Centurion');
const plan = C.dailyPlan(40);
assert.strictEqual(plan[plan.length - 1].test, true);
assert.strictEqual(plan.find(s => s.id === 's1').pace, 50);

console.log('all tests passed');
