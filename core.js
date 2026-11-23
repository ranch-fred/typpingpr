// Pure training logic: no DOM. Loaded by the browser and by test.js in Node.
(function (root) {
  'use strict';
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  const GOAL = 100;
  const LEVELS = ['Keyboard Cadet', 'Home-Row Hero', 'Steady Striker', 'Rhythm Rider', 'Flow Finder',
    'Speed Seeker', 'Velocity Vandal', 'Turbo Typist', 'Blur Fingers', 'Lightning Hands', 'Centurion'];

  // Standard WPM: 5 characters = 1 word.
  function wpm(chars, ms) { return ms > 0 ? (chars / 5) / (ms / 60000) : 0; }
  function accuracy(correct, total) { return total > 0 ? correct / total : 1; }

  function dateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Consecutive practice days ending today, or yesterday if today isn't done yet.
  function streak(days, today) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (!days[dateKey(d)]) d.setDate(d.getDate() - 1);
    let n = 0;
    while (days[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  // Per-letter stats as moving averages, so recent typing matters most.
  function recordKey(stats, ch, miss, ms) {
    const s = stats[ch] || (stats[ch] = { err: 0, ms: 0, n: 0 });
    s.n++;
    const a = Math.max(0.05, 1 / s.n);
    s.err += a * ((miss ? 1 : 0) - s.err);
    if (ms != null && ms > 0) s.ms = s.ms ? s.ms + 0.1 * (ms - s.ms) : ms;
  }

  // Letters that are most error-prone and slowest. Empty until there is enough data.
  function weakKeys(stats, n) {
    n = n || 3;
    const known = LETTERS.split('').filter(k => stats[k] && stats[k].n >= 5 && stats[k].ms > 0);
    if (known.length < 8) return [];
    const avgMs = known.reduce((a, k) => a + stats[k].ms, 0) / known.length;
    return LETTERS.split('')
      .map(k => ({ k, score: known.includes(k) ? stats[k].err * 5 + stats[k].ms / avgMs : 1.6 }))
      .sort((a, b) => b.score - a.score).slice(0, n).map(x => x.k);
  }

  // Weighted random words. With focus letters, ~70% of picks contain one, however rare the letter.
  function genWords(words, count, focus, rng) {
    focus = focus || []; rng = rng || Math.random;
    const hits = words.map(w => { let h = 0; for (const c of w) if (focus.includes(c)) h++; return h; });
    const focusMass = hits.reduce((a, h) => a + (h ? 1 + h : 0), 0);
    const plain = hits.filter(h => !h).length;
    const plainW = focusMass && plain ? (focusMass * 0.43) / plain : 1;
    const weights = hits.map(h => (h ? 1 + h : plainW));
    const total = weights.reduce((a, b) => a + b, 0);
    const out = [];
    while (out.length < count) {
      let r = rng() * total, i = 0;
      while (i < words.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
      if (words.length < 2 || words[i] !== out[out.length - 1]) out.push(words[i]);
    }
    return out;
  }

  // Days until `target` WPM at the current linear trend; null if not enough data or not improving.
  function projectDays(points, target) {
    if (points.length < 3) return null;
    const n = points.length;
    const mx = points.reduce((a, p) => a + p.x, 0) / n;
    const my = points.reduce((a, p) => a + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of points) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    if (!(slope > 0.01)) return null;
    const lastX = points[n - 1].x;
    const fitted = my + slope * (lastX - mx);
    return fitted >= target ? 0 : Math.ceil((target - fitted) / slope);
  }

  function level(w) {
    const i = Math.min(LEVELS.length - 1, Math.floor(Math.max(0, w) / 10));
    return { n: i + 1, name: LEVELS[i], from: i * 10, to: Math.min(GOAL, (i + 1) * 10) };
  }

  // Daily plan scaled to current speed. Pace cars sit just above what you can do now.
  function dailyPlan(base) {
    const b = Math.max(10, Math.round(base));
    const sprint = Math.round(b * 1.25);
    return [
      { id: 'warm', title: 'Warm-up', desc: 'Easy common words. Loose hands, eyes on the screen.', secs: 60, pool: 'easy' },
      { id: 'weak', title: 'Weak-key drill', desc: 'Words packed with the letters you miss or hesitate on.', secs: 120, pool: 'weak' },
      { id: 'acc', title: 'Precision run', desc: 'Slow down. Aim for 97%+ accuracy, no errors.', secs: 60, pool: 'all', goalAcc: 0.97 },
      { id: 's1', title: 'Sprint 1 of 3', desc: 'Short burst. Stay ahead of the pace car!', secs: 20, pool: 'easy', pace: sprint },
      { id: 's2', title: 'Sprint 2 of 3', desc: 'Short burst. Stay ahead of the pace car!', secs: 20, pool: 'easy', pace: sprint },
      { id: 's3', title: 'Sprint 3 of 3', desc: 'Short burst. Stay ahead of the pace car!', secs: 20, pool: 'easy', pace: sprint },
      { id: 'test', title: 'Daily test', desc: 'Your official score for today. Beat the pace car.', secs: 60, pool: 'all', pace: Math.round(b * 1.05), test: true },
    ];
  }

  const Core = { LETTERS, GOAL, wpm, accuracy, dateKey, streak, recordKey, weakKeys, genWords, projectDays, level, dailyPlan };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(this);
