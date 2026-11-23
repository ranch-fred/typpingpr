(() => {
  'use strict';
  const C = window.Core, WORDS = window.WORDS;
  const EASY = WORDS.slice(0, 200);
  const STORE = 'road100.v1';
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const TIPS = [
    'Feel the bumps on F and J. Every word starts and ends back on the home row.',
    'Accuracy first. Speed comes from not having to fix mistakes.',
    'Never look down. If you forget a key, turn on the Key guide and look at the screen instead.',
    'Keep your wrists floating and fingers curved. Tension makes you slow.',
    'Read one word ahead of where you are typing.',
    'Short daily sessions beat one long session a week. Protect your streak.',
    'Use the right finger every time, even when another one feels quicker. It pays off past 60 WPM.',
    'Aim for a steady rhythm instead of bursts. Even keystrokes are fast keystrokes.',
    'Hit the space bar with your thumb, without moving your hands.',
  ];
  const $ = s => document.querySelector(s);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const todayKey = () => C.dateKey(new Date());

  // ---------- storage ----------
  const blank = () => ({ v: 1, sessions: [], keys: {}, days: {}, settings: { sound: false, guide: false } });
  const valid = d => d && d.v === 1 && Array.isArray(d.sessions) && d.keys && typeof d.keys === 'object' && d.days && typeof d.days === 'object';
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE));
      if (valid(d)) return Object.assign(blank(), d, { settings: Object.assign(blank().settings, d.settings) });
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    return blank();
  }
  let db = load();
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(db)); }
    catch (e) { toast('⚠ Could not save progress: browser storage is blocked.'); }
  }

  // ---------- derived stats ----------
  const tests = () => db.sessions.filter(s => s.test);
  function baseline() {
    const t = tests().slice(-5);
    const src = t.length ? t : db.sessions.slice(-5);
    return src.length ? src.reduce((a, s) => a + s.wpm, 0) / src.length : 10;
  }
  const best = () => tests().reduce((m, s) => Math.max(m, s.wpm), 0);
  function recentAcc() {
    const r = db.sessions.slice(-10);
    return r.length ? r.reduce((a, s) => a + s.acc, 0) / r.length : null;
  }
  // Per day: best test WPM and average accuracy, from session history.
  function perDay() {
    const m = {};
    for (const s of db.sessions) {
      const k = C.dateKey(new Date(s.t));
      const d = m[k] || (m[k] = { key: k, best: 0, accSum: 0, n: 0 });
      if (s.test) d.best = Math.max(d.best, s.wpm);
      d.accSum += s.acc; d.n++;
    }
    return Object.values(m).sort((a, b) => a.key < b.key ? -1 : 1);
  }
  function dayNumber(key) {
    const [y, mo, d] = key.split('-').map(Number);
    return Math.round(new Date(y, mo - 1, d).getTime() / 86400000);
  }

  // ---------- ui helpers ----------
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  function buildKb(el) {
    el.innerHTML = '';
    const map = {};
    for (const row of ROWS) {
      const r = document.createElement('div'); r.className = 'row';
      for (const ch of row) {
        const k = document.createElement('div');
        k.className = 'k' + (ch === 'f' || ch === 'j' ? ' home' : '');
        k.textContent = ch; map[ch] = k; r.appendChild(k);
      }
      el.appendChild(r);
    }
    const r = document.createElement('div'); r.className = 'row';
    const sp = document.createElement('div'); sp.className = 'k space'; sp.textContent = 'space';
    map[' '] = sp; r.appendChild(sp); el.appendChild(r);
    return map;
  }
  const guideMap = buildKb($('#guideKb'));

  let audio = null;
  function beep(kind) {
    if (!db.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      const hit = kind === 'hit';
      o.type = hit ? 'triangle' : 'square';
      o.frequency.value = hit ? 1700 + Math.random() * 300 : 130;
      g.gain.setValueAtTime(hit ? 0.025 : 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (hit ? 0.03 : 0.12));
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + 0.13);
    } catch (e) { /* no audio available */ }
  }
  function celebrate() {
    if (reducedMotion || !window.confetti) return;
    window.confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#3ee8ff', '#ff4fd8', '#ffc94d', '#5dffa0'] });
  }

  // ---------- views ----------
  let view = 'home';
  function show(id) {
    if (id !== 'type' && run && !run.ended) { cancelAnimationFrame(raf); run = null; }
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== id; });
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === id));
    view = id;
    if (id === 'home') renderHome();
    if (id === 'progress') renderProgress();
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const has = db.sessions.length > 0;
    const b = baseline(), lv = C.level(b), bst = best();
    const st = C.streak(db.days, new Date());
    $('#heroWpm').textContent = has ? Math.round(b) : '??';
    $('#heroLevel').textContent = !has ? 'Do your first session to set your starting speed.'
      : b >= C.GOAL ? `Level ${lv.n} · ${lv.name}. You made it to 100!`
      : `Level ${lv.n} · ${lv.name}. ${Math.max(1, Math.ceil(lv.to - b))} wpm to the next level.`;
    $('#greet').textContent = st > 1 ? `🔥 ${st}-day streak. Keep it alive.` : st === 1 ? 'Day 1 of your streak' : 'Daily training';
    const pct = has ? Math.min(100, (b / C.GOAL) * 100) : 0;
    $('#ringPct').textContent = Math.round(pct) + '%';
    requestAnimationFrame(() => {
      $('#ringFg').style.strokeDashoffset = 326.7 * (1 - pct / 100);
      $('#roadFill').style.width = pct + '%';
    });
    $('#roadBest').style.left = `calc(${Math.min(100, bst)}% - 2px)`;
    $('#roadBest').hidden = !bst;
    $('#roadTicks').innerHTML = Array.from({ length: 11 }, (_, i) => `<span style="left:${i * 10}%">${i * 10}</span>`).join('');
    $('#sStreak').textContent = st;
    $('#sBest').textContent = bst ? Math.round(bst) : '–';
    const ra = recentAcc();
    $('#sAcc').textContent = ra == null ? '–' : Math.round(ra * 100) + '%';
    const d = db.days[todayKey()];
    $('#planDone').hidden = !(d && d.plans);
    $('#startPlan').firstChild.textContent = d && d.plans ? 'Train again ' : 'Start training ';
    $('#planSteps').innerHTML = C.dailyPlan(b).map(s =>
      `<li><b>${s.title}</b><span>${s.secs}s${s.pace ? ' · pace ' + s.pace : ''}</span></li>`).join('');
    $('#tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  // ---------- typing engine ----------
  let run = null, raf = 0, plan = null, resultAt = 0;
  const practice = { secs: '60', pool: 'all', pace: '1.05' };

  function poolWords(pool) {
    if (pool === 'easy') return { words: EASY, focus: [] };
    if (pool === 'weak') return { words: WORDS, focus: C.weakKeys(db.keys, 3) };
    return { words: WORDS, focus: [] };
  }

  function startRun(opts) {
    cancelAnimationFrame(raf);
    const src = poolWords(opts.pool);
    const track = $('#track');
    run = { opts, src, text: '', spans: [], pos: 0, typed: 0, errors: 0, hadErr: false, start: 0, last: 0,
      combo: 0, maxCombo: 0, ended: false, paceIdx: -1, lastHud: 0, shift: 0, lh: 0 };
    track.innerHTML = ''; track.style.transform = '';
    appendWords(Math.max(40, Math.ceil(opts.secs * 2.6)));

    let desc = opts.desc || '';
    if (opts.pool === 'weak') desc += src.focus.length ? ` Focus letters: ${src.focus.join('  ')}.` : ' Still learning your weak spots, so mixed words for now.';
    if (opts.pace) desc += ` Pace car: ${opts.pace} wpm.`;
    $('#tStep').textContent = opts.label;
    $('#tTitle').textContent = opts.title;
    $('#tDesc').textContent = desc;
    $('#hPaceBox').hidden = !opts.pace;
    $('#hPaceBox').className = '';
    $('#hPace').textContent = '0';
    $('#hTime').textContent = opts.secs;
    $('#hWpm').textContent = '–';
    $('#hAcc').textContent = '100';
    $('#hCombo').textContent = '0';
    $('#hCombo').parentElement.className = 'combo';
    $('#timeFill').style.transform = 'scaleX(1)';
    $('#typebox').classList.remove('typing');
    $('#startHint').classList.remove('gone');
    $('#caps').hidden = true;
    $('#guideKb').hidden = !db.settings.guide;
    show('type');
    if (document.activeElement) document.activeElement.blur();
    run.lh = parseFloat(getComputedStyle(track).lineHeight) || 40;
    setCurrent();
  }

  function appendWords(n) {
    const frag = document.createDocumentFragment();
    for (const w of C.genWords(run.src.words, n, run.src.focus)) {
      if (run.text) {
        const sp = document.createElement('span'); sp.className = 'c'; sp.textContent = ' ';
        frag.appendChild(sp); run.spans.push(sp); run.text += ' ';
      }
      const wEl = document.createElement('span'); wEl.className = 'w';
      for (const ch of w) {
        const s = document.createElement('span'); s.className = 'c'; s.textContent = ch;
        wEl.appendChild(s); run.spans.push(s);
      }
      frag.appendChild(wEl); run.text += w;
    }
    $('#track').appendChild(frag);
  }

  function setCurrent() {
    const prev = run.spans[run.pos - 1];
    if (prev) prev.classList.remove('cur', 'err');
    const cur = run.spans[run.pos];
    cur.classList.add('cur');
    // Keep the current line as the 1st or 2nd visible line.
    const line = Math.round(cur.offsetTop / run.lh);
    const shift = Math.max(0, line - 1) * run.lh;
    if (shift !== run.shift) { run.shift = shift; $('#track').style.transform = `translateY(${-shift}px)`; }
    if (db.settings.guide) {
      for (const k in guideMap) guideMap[k].classList.remove('next');
      const g = guideMap[run.text[run.pos]];
      if (g) g.classList.add('next');
    }
  }

  function typeKey(key, capsOn) {
    $('#caps').hidden = !capsOn;
    const k = key.toLowerCase();
    const now = performance.now();
    if (!run.start) {
      run.start = now; run.last = now;
      $('#typebox').classList.add('typing');
      $('#startHint').classList.add('gone');
      raf = requestAnimationFrame(tick);
    }
    const exp = run.text[run.pos];
    const cur = run.spans[run.pos];
    run.typed++;
    if (k === exp) {
      const dt = now - run.last;
      if (exp !== ' ') C.recordKey(db.keys, exp, run.hadErr, !run.hadErr && dt < 2000 ? dt : null);
      cur.classList.remove('err');
      cur.classList.add(run.hadErr ? 'fix' : 'ok');
      if (!run.hadErr) run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      run.hadErr = false; run.pos++; run.last = now;
      if (run.pos > run.text.length - 60) appendWords(30);
      setCurrent();
      beep('hit');
    } else {
      run.errors++; run.hadErr = true; run.combo = 0; run.last = now;
      cur.classList.add('err');
      const box = $('#typebox');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
      beep('miss');
    }
    const cb = $('#hCombo');
    cb.textContent = run.combo;
    cb.parentElement.className = 'combo' + (run.combo >= 60 ? ' fire' : run.combo >= 25 ? ' hot' : '');
  }

  function tick() {
    if (!run || run.ended) return;
    const now = performance.now(), el = now - run.start, total = run.opts.secs * 1000;
    if (el >= total) { finish(); return; }
    if (now - run.lastHud > 100) {
      run.lastHud = now;
      $('#hTime').textContent = Math.ceil((total - el) / 1000);
      $('#hWpm').textContent = el > 1500 ? Math.round(C.wpm(run.pos, el)) : '–';
      $('#hAcc').textContent = Math.round(C.accuracy(run.typed - run.errors, run.typed) * 100);
    }
    $('#timeFill').style.transform = `scaleX(${1 - el / total})`;
    if (run.opts.pace) {
      const idx = Math.min(run.spans.length - 1, Math.floor((run.opts.pace * 5 / 60000) * el));
      if (idx !== run.paceIdx) {
        if (run.paceIdx >= 0) run.spans[run.paceIdx].classList.remove('pace');
        run.spans[idx].classList.add('pace');
        run.paceIdx = idx;
        const diff = run.pos - idx;
        $('#hPace').textContent = (diff >= 0 ? '+' : '−') + Math.abs(diff);
        $('#hPaceLbl').textContent = diff >= 0 ? 'chars ahead' : 'chars behind';
        $('#hPaceBox').className = diff >= 0 ? 'ahead' : 'behind';
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function finish() {
    run.ended = true;
    cancelAnimationFrame(raf);
    const o = run.opts, ms = o.secs * 1000;
    const r = { t: Date.now(), title: o.title, test: !!o.test, secs: o.secs, pace: o.pace || 0,
      wpm: Math.round(C.wpm(run.pos, ms) * 10) / 10,
      acc: Math.round(C.accuracy(run.typed - run.errors, run.typed) * 1000) / 1000,
      combo: run.maxCombo };
    const counted = run.typed >= 5;
    const prevBest = best();
    if (counted) {
      db.sessions.push(r);
      const d = db.days[todayKey()] || (db.days[todayKey()] = { ms: 0, plans: 0 });
      d.ms += ms;
    }
    if (plan) {
      plan.results.push(r);
      plan.done = plan.i === plan.steps.length - 1;
      if (plan.done && db.days[todayKey()]) db.days[todayKey()].plans++;
    }
    save();
    showResult(r, counted, prevBest);
  }

  function showResult(r, counted, prevBest) {
    $('#rStep').textContent = run.opts.label;
    $('#rTitle').textContent = plan && plan.done ? 'Session complete! 🎉' : r.title;
    $('#rWpm').textContent = Math.round(r.wpm);
    $('#rAcc').textContent = Math.round(r.acc * 100);
    $('#rCombo').textContent = r.combo;

    const notes = [];
    let party = false;
    if (!counted) notes.push('Too few keys pressed, so this run was not recorded.');
    if (counted && r.test && r.wpm > prevBest) {
      party = true;
      notes.push(prevBest ? `🏆 <b>New personal best!</b> +${(r.wpm - prevBest).toFixed(1)} wpm over your old record.` : '📍 <b>First score recorded.</b> This is your starting line.');
    }
    if (r.pace) notes.push(r.wpm >= r.pace ? `🏁 You beat the pace car (${r.pace} wpm)!` : `Pace car was ${r.pace} wpm. ${Math.ceil(r.pace - r.wpm)} to go.`);
    const goalAcc = run.opts.goalAcc;
    if (goalAcc) notes.push(r.acc >= goalAcc ? '🎯 Precision target hit. That is how speed gets built.' : `Accuracy below ${goalAcc * 100}%. Slow down until it is clean.`);
    else if (counted && r.acc < 0.92) notes.push('Accuracy under 92%. Slow down a notch. Every fix costs you more time than a careful keystroke.');
    $('#rNote').innerHTML = notes.join('<br>');

    const sum = $('#rSummary');
    sum.hidden = !(plan && plan.done);
    if (plan && plan.done) {
      sum.innerHTML = plan.results.map(x =>
        `<div class="row"><span>${x.title}</span><span>${Math.round(x.wpm)} wpm · ${Math.round(x.acc * 100)}%</span></div>`).join('');
      const days = perDay().filter(d => d.best > 0);
      if (days.length >= 2) {
        const diff = days[days.length - 1].best - days[days.length - 2].best;
        sum.innerHTML += `<div class="row"><span><b>vs last test day</b></span><span>${diff >= 0 ? '+' : ''}${diff.toFixed(1)} wpm</span></div>`;
      }
      party = true;
    }
    $('#rNext').firstChild.textContent = plan
      ? (plan.done ? 'See progress ' : `Next: ${plan.steps[plan.i + 1].title} `)
      : 'Again ';
    show('result');
    resultAt = performance.now();
    if (party) celebrate();
  }

  function startPlan() {
    plan = { steps: C.dailyPlan(baseline()), i: 0, results: [], done: false };
    runStep();
  }
  function runStep() {
    const s = plan.steps[plan.i];
    startRun(Object.assign({}, s, { label: `Step ${plan.i + 1} of ${plan.steps.length}` }));
  }
  function startPractice() {
    plan = null;
    const p = Number(practice.pace), secs = Number(practice.secs);
    startRun({ title: 'Free practice', label: 'Practice', secs, pool: practice.pool,
      pace: p ? Math.round(baseline() * p) : 0, test: practice.pool === 'all' && secs >= 30 });
  }
  function next() {
    if (plan && !plan.done) { plan.i++; runStep(); }
    else if (plan) { plan = null; show('progress'); }
    else startPractice();
  }

  // ---------- progress ----------
  let chart = null;
  function renderProgress() {
    const days = perDay(), testDays = days.filter(d => d.best > 0);
    $('#pCur').textContent = tests().length ? Math.round(baseline()) : '–';
    $('#pBest').textContent = best() ? Math.round(best()) : '–';
    $('#pTime').textContent = Math.round(Object.values(db.days).reduce((a, d) => a + (d.ms || 0), 0) / 60000);

    const eta = C.projectDays(testDays.slice(-30).map(d => ({ x: dayNumber(d.key), y: d.best })), C.GOAL);
    if (eta === null) { $('#pEta').textContent = '–'; $('#pEtaSub').textContent = testDays.length < 3 ? 'needs 3+ test days' : 'trend not rising yet, keep going'; }
    else if (eta === 0) { $('#pEta').textContent = '🎉'; $('#pEtaSub').textContent = 'goal reached'; }
    else {
      const when = new Date(); when.setDate(when.getDate() + eta);
      $('#pEta').textContent = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      $('#pEtaSub').textContent = `~${eta} days at your current trend`;
    }

    // Chart
    $('#chartEmpty').hidden = testDays.length > 0;
    if (chart) { chart.destroy(); chart = null; }
    if (window.Chart && testDays.length) {
      const labels = testDays.map(d => d.key.slice(5));
      const vals = testDays.map(d => d.best);
      const avg = vals.map((_, i) => { const w = vals.slice(Math.max(0, i - 6), i + 1); return Math.round(w.reduce((a, b) => a + b, 0) / w.length * 10) / 10; });
      const ctx = $('#chart').getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 0, 300);
      grad.addColorStop(0, 'rgba(62,232,255,.35)'); grad.addColorStop(1, 'rgba(62,232,255,0)');
      chart = new window.Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [
          { label: 'Daily test', data: vals, borderColor: '#3ee8ff', backgroundColor: grad, fill: true, tension: 0.35, pointRadius: 3, pointBackgroundColor: '#3ee8ff' },
          { label: '7-day average', data: avg, borderColor: '#ff4fd8', borderDash: [6, 4], pointRadius: 0, tension: 0.35 },
          { label: 'Goal', data: labels.map(() => C.GOAL), borderColor: 'rgba(255,201,77,.7)', borderWidth: 1, pointRadius: 0, borderDash: [2, 4] },
        ] },
        options: {
          maintainAspectRatio: false, animation: reducedMotion ? false : { duration: 900 },
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { min: 0, suggestedMax: 110, grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#8590b3' } },
            x: { grid: { display: false }, ticks: { color: '#8590b3', maxRotation: 0, autoSkip: true } },
          },
          plugins: { legend: { labels: { color: '#e8edff', boxWidth: 12 } } },
        },
      });
    } else if (!window.Chart && testDays.length) {
      $('#chartEmpty').hidden = false;
      $('#chartEmpty').textContent = 'Chart library did not load (offline?). Your data is safe.';
    }

    // Heatmap
    const heat = buildKb($('#heatKb'));
    const known = C.LETTERS.split('').filter(k => db.keys[k] && db.keys[k].n >= 5 && db.keys[k].ms > 0);
    const avgMs = known.length ? known.reduce((a, k) => a + db.keys[k].ms, 0) / known.length : 0;
    for (const ch of C.LETTERS) {
      const el = heat[ch], s = db.keys[ch];
      if (!s || s.n < 5 || !s.ms) { el.classList.add('none'); el.title = `${ch}: not enough data yet`; continue; }
      const bad = Math.min(1, s.err / 0.15) * 0.6 + Math.min(1, Math.max(0, s.ms / avgMs - 0.8) / 0.8) * 0.4;
      el.style.background = `hsl(${Math.round(140 * (1 - bad))} 85% 58%)`;
      el.title = `${ch}: ${Math.round(s.err * 100)}% errors · ${Math.round(s.ms)} ms · ${s.n} presses`;
    }
    heat[' '].classList.add('none');
    heat[' '].title = '';
    const weak = C.weakKeys(db.keys, 3);
    $('#weakList').textContent = weak.length ? weak.join(', ') : 'type a bit more to find out';

    // Calendar: 16 weeks, columns are weeks starting Sunday.
    const cal = $('#cal'); cal.innerHTML = '';
    const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 15 * 7);
    for (const d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const k = C.dateKey(d), m = ((db.days[k] && db.days[k].ms) || 0) / 60000;
      const i = document.createElement('i');
      i.className = (m === 0 ? '' : m < 3 ? 'l1' : m < 7 ? 'l2' : m < 12 ? 'l3' : 'l4') + (k === todayKey() ? ' today' : '');
      i.title = `${k}: ${m.toFixed(1)} min`;
      cal.appendChild(i);
    }

    // Recent runs
    const rows = db.sessions.slice(-15).reverse().map(s => {
      const when = new Date(s.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `<tr><td>${when}</td><td>${esc(s.title)}${s.test ? ' ⭐' : ''}</td><td class="num">${Math.round(s.wpm)}</td><td class="num">${Math.round(s.acc * 100)}%</td><td class="num">${s.secs}s</td></tr>`;
    });
    $('#runs tbody').innerHTML = rows.join('') || '<tr><td colspan="5" class="muted">No runs yet.</td></tr>';
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- events ----------
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (view === 'type' && run && !run.ended) {
      if (e.key === 'Escape') { e.preventDefault(); plan = null; show('home'); return; }
      if (e.key.length !== 1 || !/[a-zA-Z ]/.test(e.key)) return;
      e.preventDefault();
      typeKey(e.key, e.getModifierState && e.getModifierState('CapsLock'));
      return;
    }
    if (e.target.closest && e.target.closest('button, input, label, a, select, textarea')) return;
    if (e.key === 'Enter') {
      if (view === 'home') { e.preventDefault(); startPlan(); }
      else if (view === 'practice') { e.preventDefault(); startPractice(); }
      // Ignore Enter right after a run ends, so a stray key doesn't skip the result.
      else if (view === 'result' && performance.now() - resultAt > 500) { e.preventDefault(); next(); }
    }
    if (e.key === 'Escape' && view === 'result') { plan = null; show('home'); }
  });

  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { plan = null; show(b.dataset.go); }));
  $('#startPlan').addEventListener('click', startPlan);
  $('#startPractice').addEventListener('click', startPractice);
  $('#quit').addEventListener('click', () => { plan = null; show('home'); });
  $('#rNext').addEventListener('click', next);
  $('#rHome').addEventListener('click', () => { plan = null; show('home'); });

  document.querySelectorAll('.seg').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    practice[seg.dataset.name] = b.dataset.v;
  }));

  $('#optGuide').checked = db.settings.guide;
  $('#optSound').checked = db.settings.sound;
  $('#optGuide').addEventListener('change', e => {
    db.settings.guide = e.target.checked; save();
    $('#guideKb').hidden = !db.settings.guide;
    if (run && !run.ended) setCurrent();
  });
  $('#optSound').addEventListener('change', e => { db.settings.sound = e.target.checked; save(); });

  $('#exportBtn').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `road-to-100-backup-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      let d;
      try { d = JSON.parse(rd.result); } catch (err) { toast('That file is not valid JSON.'); return; }
      if (!valid(d)) { toast('That file is not a Road to 100 backup.'); return; }
      if (!confirm(`Replace your current progress with this backup (${d.sessions.length} runs)?`)) return;
      db = Object.assign(blank(), d, { settings: Object.assign(blank().settings, d.settings) });
      save(); renderProgress(); toast('Backup restored.');
    };
    rd.onerror = () => toast('Could not read that file.');
    rd.readAsText(f);
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Delete ALL your progress? This cannot be undone. Export a backup first if unsure.')) return;
    db = blank(); save(); renderProgress(); toast('Progress reset.');
  });

  show('home');
})();
