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

// Lifetime letter totals: every press counts equally, and older data without totals is kept.
const life = {};
for (let i = 0; i < 100; i++) C.recordKey(life, 'a', i < 50, i < 50 ? null : 200);
assert.strictEqual(C.keyTotals(life.a).err, 0.5);
assert.strictEqual(C.keyTotals(life.a).ms, 200);
const oldKey = { e: { err: 0.1, ms: 300, n: 100 } };
assert.deepStrictEqual(C.keyTotals(oldKey.e), { n: 100, err: 0.1, ms: 300 });
C.recordKey(oldKey, 'e', true, null);
assert.strictEqual(C.keyTotals(oldKey.e).n, 101);
assert(Math.abs(C.keyTotals(oldKey.e).err - 11 / 101) < 1e-9);

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
assert.strictEqual(C.planDoneSecs(plan, plan.length, 0), 1200, 'plan must be exactly 20 minutes');
assert.strictEqual(C.planDoneSecs(plan, 0, 0), 0);
assert.strictEqual(C.planDoneSecs(plan, 1, 0), 120);
assert.strictEqual(C.planDoneSecs(plan, 2, 1), 180 + 90);
assert.strictEqual(plan.filter(b => b.rounds.some(r => r.test)).length, 1);
assert.strictEqual(plan.find(b => b.id === 'sprint').rounds[0].pace, 50);
assert.strictEqual(plan.find(b => b.id === 'free').rounds.length, 3);

// Remap today's position from the old 60-minute layout.
const OLD = ['warm', 'test', 'prec', 'weak', 'sprint', 'endure', 'weak2', 'cool'];
assert.deepStrictEqual(C.remapPosition(OLD, plan, 0, 0), { block: 0, round: 0 });
assert.deepStrictEqual(C.remapPosition(OLD, plan, 0, 1), { block: 0, round: 1 });
assert.deepStrictEqual(C.remapPosition(OLD, plan, 0, 3), { block: 1, round: 0 }); // 3 of old 5 warm-ups > new 2
assert.deepStrictEqual(C.remapPosition(OLD, plan, 2, 0), { block: 2, round: 0 }); // warm-up + test done
assert.deepStrictEqual(C.remapPosition(OLD, plan, 5, 1), { block: 5, round: 0 }); // up to sprints done -> free type next
assert.deepStrictEqual(C.remapPosition(OLD, plan, 8, 0), { block: 5, round: 0 }); // old plan finished; free type is new
assert.deepStrictEqual(C.remapPosition(OLD.concat('free'), plan, 9, 0), { block: plan.length, round: 0 });

// Longest streak.
assert.strictEqual(C.longestStreak({}), 0);
assert.strictEqual(C.longestStreak({ '2026-11-28': 1, '2026-11-29': 1, '2026-11-30': 1, '2026-12-01': 1, '2026-12-05': 1 }), 4);
assert.strictEqual(C.longestStreak({ '2026-11-01': 1, '2026-11-02': 0, '2026-11-03': 1 }), 1);

console.log('all tests passed');
