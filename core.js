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

  function dayNumber(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.round(new Date(y, m - 1, d).getTime() / 86400000);
  }

  // Longest run of consecutive keys in a {dateKey: truthy} map.
  function longestStreak(days) {
    const nums = Object.keys(days).filter(k => days[k]).map(dayNumber).sort((a, b) => a - b);
    let best = 0, cur = 0;
    for (let i = 0; i < nums.length; i++) {
      cur = i > 0 && nums[i] === nums[i - 1] + 1 ? cur + 1 : 1;
      best = Math.max(best, cur);
    }
    return best;
  }

  // The daily hour: 60 minutes of typing time in blocks of rounds, scaled to current speed.
  // Pace cars sit just above what you can do now.
  function hourPlan(base) {
    const b = Math.max(10, Math.round(base));
    const rep = (n, r) => Array.from({ length: n }, () => Object.assign({}, r));
    return [
      { id: 'warm', title: 'Warm-up', desc: 'Easy common words. Loose hands, eyes on the screen.', rounds: rep(5, { secs: 60, pool: 'easy' }) },
      { id: 'test', title: 'Daily test', desc: 'One minute. Your official score for today.', rounds: [{ secs: 60, pool: 'all', pace: Math.round(b * 1.05), test: true }] },
      { id: 'prec', title: 'Precision', desc: 'Slow and clean. Aim for 97% accuracy or better.', rounds: rep(5, { secs: 120, pool: 'all', goalAcc: 0.97 }) },
      { id: 'weak', title: 'Weak keys', desc: 'Words packed with the letters you miss or hesitate on.', rounds: rep(5, { secs: 120, pool: 'weak' }) },
      { id: 'sprint', title: 'Sprints', desc: '30-second bursts. Stay ahead of the pace car.', rounds: rep(20, { secs: 30, pool: 'easy', pace: Math.round(b * 1.25) }) },
      { id: 'endure', title: 'Endurance', desc: 'Two 5-minute runs. Keep a steady rhythm.', rounds: rep(2, { secs: 300, pool: 'all', pace: b }) },
      { id: 'weak2', title: 'Weak keys II', desc: 'Second pass on your trouble letters.', rounds: rep(5, { secs: 120, pool: 'weak' }) },
      { id: 'cool', title: 'Cool-down', desc: 'Easy words. Relaxed and accurate.', rounds: rep(4, { secs: 60, pool: 'easy' }) },
    ];
  }

  // Seconds of the plan finished before position (block, round).
  function planDoneSecs(plan, block, round) {
    let s = 0;
    for (let i = 0; i < plan.length && i <= block; i++) {
      const n = i < block ? plan[i].rounds.length : Math.min(round, plan[i].rounds.length);
      for (let j = 0; j < n; j++) s += plan[i].rounds[j].secs;
    }
    return s;
  }

  const Core = { LETTERS, GOAL, wpm, accuracy, dateKey, dayNumber, streak, longestStreak, recordKey, weakKeys, genWords,
    projectDays, level, hourPlan, planDoneSecs };
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
  else root.Core = Core;
})(this);
