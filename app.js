(() => {
  'use strict';
  const C = window.Core, WORDS = window.WORDS;
  const EASY = WORDS.slice(0, 200);
  const STORE = 'road100.v1'; // same key as before, so existing progress carries over
  const STREAK_MS = 15 * 60000; // minutes of typing that keep the streak alive
  const MAX_SESSIONS = 1500; // older rounds live on as daily summaries in db.days
  const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const TIPS = [
    'Feel the bumps on F and J. Every word starts and ends back on the home row.',
    'Accuracy first. Speed comes from not having to fix mistakes.',
    'Never look down. If you forget a key, turn on the Key guide and look at the screen instead.',
    'Keep your wrists floating and fingers curved. Tension makes you slow.',
    'Read one word ahead of where you are typing.',
    'Short breaks between blocks keep your hands fresh for the whole session.',
    'In Free type, think of the whole sentence first, then type it in one smooth go.',
    'Use the right finger every time, even when another one feels quicker. It pays off past 60 WPM.',
    'Aim for a steady rhythm instead of bursts. Even keystrokes are fast keystrokes.',
    'Hit the space bar with your thumb, without moving your hands.',
    'When a letter turns red, stop, Backspace, and type it slowly once. That is how the fix sticks.',
  ];
  // Each block of the session has its own color: [main, darker edge].
  const BLOCK_COLORS = {
    warm: ['#f59f00', '#c77f00'], test: ['#3b5bdb', '#2b44a8'], prec: ['#2f9e44', '#237032'], weak: ['#7048e8', '#5434b8'],
    sprint: ['#f03e3e', '#c22f2f'], free: ['#e64980', '#b8346a'], endure: ['#0ca678', '#087f5b'], cool: ['#1c9be6', '#1478b4'],
  };
  // Block order of the old 60-minute plan, used once to carry today's place over to the 20-minute plan.
  const OLD_PLAN_IDS = ['warm', 'test', 'prec', 'weak', 'sprint', 'endure', 'weak2', 'cool'];
  const PLAN_V = 2;
  const QUESTIONS = [
    'what did you eat today and did you like it',
    'describe your bedroom to someone who has never seen it',
    'what is your favorite game and why do you like it',
    'tell me about your best friend',
    'what would you do with a whole free day',
    'describe the weather outside right now',
    'what is something new you learned this week',
    'if you could have any animal as a pet what would it be and why',
    'describe your dream house',
    'what would you do if you could fly for one day',
    'what is your favorite food and how is it made',
    'tell me about a movie or show you really like',
    'what do you want to get better at this year',
    'describe a perfect weekend',
    'what is the best place you have ever visited',
    'if you could invent something what would it be',
    'what makes a good friend',
    'describe your morning from waking up to now',
    'what would you buy if someone gave you a hundred dollars',
    'what is a skill you are proud of and how did you learn it',
  ];
  const PRACTICE_COLOR = ['#7048e8', '#5434b8'];
  const COMBO_SHOUTS = { 10: 'Nice! 10', 25: 'Great! 25', 50: 'On fire! 50', 75: 'Wow! 75', 100: 'Unstoppable! 100', 150: 'Legend! 150', 200: 'Machine! 200' };
  const CONFETTI = ['#ff8a00', '#f5b300', '#3b5bdb', '#2f9e44', '#e64980', '#7048e8', '#0ca678'];
  const MOUTH = { smile: 'M38 60 Q50 72 62 60', grin: 'M35 56 Q50 80 65 56 Z', oops: 'M41 67 Q50 58 59 67' };
  const KIP = `<svg class="kip" viewBox="0 0 100 100" aria-hidden="true">
    <rect class="kip-base" x="8" y="20" width="84" height="74" rx="20"/>
    <rect class="kip-top" x="8" y="8" width="84" height="76" rx="20"/>
    <g class="kip-eyes"><ellipse cx="36" cy="40" rx="6" ry="8.5"/><ellipse cx="64" cy="40" rx="6" ry="8.5"/></g>
    <ellipse class="kip-cheek" cx="23" cy="56" rx="6.5" ry="4"/><ellipse class="kip-cheek" cx="77" cy="56" rx="6.5" ry="4"/>
    <path class="kip-mouth" d="${MOUTH.smile}"/></svg>`;
  const $ = s => document.querySelector(s);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const todayKey = () => C.dateKey(new Date());
  const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  // ---------- storage ----------
  const blank = () => ({ v: 2, sessions: [], keys: {}, days: {}, plan: null, settings: { sound: false, guide: false } });
  const valid = d => d && (d.v === 1 || d.v === 2) && Array.isArray(d.sessions) && isObj(d.keys) && isObj(d.days);
  function addToDay(days, s, addMs) {
    const k = C.dateKey(new Date(s.t));
    const d = days[k] || (days[k] = { ms: 0, best: 0, accSum: 0, n: 0, perfect: false });
    if (addMs) d.ms += s.secs * 1000;
    if (s.test) { d.best = Math.max(d.best, s.wpm); d.tested = true; }
    d.accSum += s.acc; d.n++;
    return d;
  }
  function migrate(d) {
    const out = Object.assign(blank(), d, { settings: Object.assign(blank().settings, d.settings) });
    if (d.v === 1) {
      // v1 stored only minutes per day; rebuild the daily summaries from the round history.
      for (const k in out.days) out.days[k] = { ms: out.days[k].ms || 0, best: 0, accSum: 0, n: 0, perfect: false };
      for (const s of out.sessions) addToDay(out.days, s, false);
      out.v = 2; out.plan = null;
    }
    return out;
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE));
      if (valid(d)) return migrate(d);
    } catch (e) { /* storage blocked or corrupt: start fresh */ }
    return blank();
  }
  let db = load();
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(db)); }
    catch (e) { toast('Could not save progress: browser storage is blocked or full.'); }
  }

  // ---------- derived stats ----------
  const tests = () => db.sessions.filter(s => s.test);
  function baseline() {
    const t = tests().slice(-5);
    const src = t.length ? t : db.sessions.slice(-5);
    return src.length ? avg(src.map(s => s.wpm)) : 10;
  }
  const bestTest = () => Object.values(db.days).reduce((m, d) => Math.max(m, d.best || 0), 0);
  const todayMs = () => (db.days[todayKey()] && db.days[todayKey()].ms) || 0;
  // A day keeps the streak if you finished a daily test, or typed 15+ minutes of anything.
  const dayLit = d => !!d && (d.tested || d.best > 0 || d.ms >= STREAK_MS);
  const todayLit = () => dayLit(db.days[todayKey()]);
  function qualified() {
    const q = {};
    for (const k in db.days) if (dayLit(db.days[k])) q[k] = 1;
    return q;
  }
  const streakNow = () => C.streak(qualified(), new Date());

  // Today's session: position is (block, round), reset each day.
  function plan() {
    const k = todayKey();
    if (!db.plan || db.plan.date !== k) db.plan = { date: k, block: 0, round: 0, base: baseline(), v: PLAN_V };
    if (db.plan.v !== PLAN_V) {
      // Saved during the old 60-minute plan: keep the blocks already done today.
      Object.assign(db.plan, C.remapPosition(OLD_PLAN_IDS, C.dailyPlan(db.plan.base), db.plan.block, db.plan.round), { v: PLAN_V });
      save();
    }
    return db.plan;
  }
  const blocks = () => C.dailyPlan(plan().base);
  const planSecs = () => C.planDoneSecs(blocks(), plan().block, plan().round);
  const goalMin = () => Math.round(C.planDoneSecs(blocks(), blocks().length, 0) / 60);
  const planDone = () => plan().block >= blocks().length;
  const blockSecs = b => b.rounds.reduce((a, r) => a + r.secs, 0);

  // ---------- ui helpers ----------
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
  }
  const icon = id => `<svg><use href="#${id}"/></svg>`;
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
  function confetti(small) {
    if (reducedMotion || !window.confetti) return;
    window.confetti(small
      ? { particleCount: 60, spread: 60, startVelocity: 35, origin: { y: 0.4 }, colors: CONFETTI }
      : { particleCount: 160, spread: 90, origin: { y: 0.6 }, colors: CONFETTI });
  }
  // Small burst of colored bits from a point on screen.
  function burst(x, y, n, colors, spread) {
    if (reducedMotion) return;
    const layer = $('#fx');
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const a = Math.random() * Math.PI * 2, d = spread * (0.45 + Math.random() * 0.8);
      p.className = Math.random() < 0.5 ? 'round' : '';
      p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - spread * 0.35}px`;
      p.addEventListener('animationend', () => p.remove());
      layer.appendChild(p);
    }
  }
  function restartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // Mascot moods: 'happy' (hop + grin) or 'oops' (shake + frown), back to smiling after `ms`.
  function mood(sel, m, ms) {
    const w = $(sel);
    if (!w) return;
    clearTimeout(w._t);
    w.classList.remove('happy', 'oops');
    restartAnim(w, m);
    w.querySelector('.kip-mouth').setAttribute('d', MOUTH[m === 'oops' ? 'oops' : 'grin']);
    w._t = setTimeout(() => { w.classList.remove(m); w.querySelector('.kip-mouth').setAttribute('d', MOUTH.smile); }, ms || 700);
  }
  function countUp(el, to) {
    if (reducedMotion) { el.textContent = to; return; }
    const t0 = performance.now(), dur = 800;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function setAccent(el, colors) {
    el.style.setProperty('--accent', colors[0]);
    el.style.setProperty('--accent-dk', colors[1]);
  }
  ['#kipHome', '#kipType', '#kipResult'].forEach(s => { $(s).innerHTML = KIP; });
  function renderWeek(el) {
    const q = qualified(), now = new Date();
    let html = '';
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const k = C.dateKey(d), day = db.days[k];
      const cls = day && day.perfect ? 'gold' : q[k] ? 'on' : '';
      html += `<div class="day ${cls}${i === 0 ? ' is-today' : ''}" title="${k}"><i>${cls === 'gold' ? icon('crown') : cls ? icon('flame') : ''}</i>${'SMTWTFS'[d.getDay()]}</div>`;
    }
    el.innerHTML = html;
  }
  function renderChrome() {
    $('#chipStreakN').textContent = streakNow();
    $('#chipStreak').classList.toggle('lit', todayLit());
    $('#chipMinN').textContent = Math.floor(planSecs() / 60);
    $('#chipMinGoal').textContent = '/' + goalMin();
  }

  // ---------- views ----------
  let view = 'home';
  function show(id) {
    if (id !== 'type' && run && !run.ended) { cancelAnimationFrame(raf); run = null; }
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== id; });
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.go === id));
    view = id;
    renderChrome();
    if (id === 'home') renderHome();
    if (id === 'progress') renderProgress();
    window.scrollTo(0, 0);
  }

  function renderHome() {
    const p = plan(), bl = blocks(), secs = planSecs(), done = planDone();
    const mins = Math.floor(secs / 60), goal = goalMin();
    $('#todayKicker').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    $('#todayTitle').textContent = done ? 'All done for today!' : secs ? 'Keep going' : `Your daily ${goal} minutes`;
    $('#todayMin').textContent = mins;
    $('#todayGoal').textContent = `/ ${goal} min`;
    $('#todayMeter').setAttribute('aria-valuenow', mins);
    $('#todayMeter').setAttribute('aria-valuemax', goal);
    const card = $('#todayCard');
    card.classList.toggle('complete', done);
    if (!done) { const c = BLOCK_COLORS[bl[p.block].id]; card.style.setProperty('--c', c[0]); card.style.setProperty('--c-dk', c[1]); }
    else { card.style.removeProperty('--c'); card.style.removeProperty('--c-dk'); }
    requestAnimationFrame(() => { $('#todayFill').style.width = Math.min(100, secs / (goal * 0.6)) + '%'; });
    $('#startHour').firstChild.textContent = done ? 'Free practice ' : secs ? `Continue: ${bl[p.block].title} ` : "Start today's session ";
    $('#todayNote').textContent = done
      ? 'You finished the whole session today. Extra practice still counts toward your stats.'
      : 'Only time spent typing counts. Stop whenever you like and pick up where you left off.';

    $('#path').innerHTML = bl.map((b, i) => {
      const state = i < p.block ? 'done' : i === p.block ? 'current' : 'todo';
      const n = b.rounds.length, m = Math.round(blockSecs(b) / 60);
      const dot = state === 'done' ? icon('check') : i + 1;
      const prog = state === 'current' ? `${p.round}/${n}` : state === 'done' ? 'done' : '';
      const [c, cd] = BLOCK_COLORS[b.id];
      return `<li class="node ${state}" style="--c:${c};--c-dk:${cd};--i:${i}"><span class="dot">${dot}</span><div class="node-body"><div class="grow"><b>${b.title}</b><span>${m} min · ${n} round${n > 1 ? 's' : ''} · ${b.desc}</span></div><span class="node-prog">${prog}</span></div></li>`;
    }).join('');

    const st = streakNow(), lit = todayLit();
    $('#streakCard').classList.toggle('lit', lit);
    $('#streakN').textContent = st;
    $('#streakMsg').textContent = lit ? 'Streak extended today. See you tomorrow!'
      : st ? "Finish today's daily test to keep your streak alive."
      : "Finish today's daily test to start a streak.";
    renderWeek($('#week'));
    $('#kipSay').textContent = done ? 'Perfect day! I am so proud of you.'
      : st && !lit ? `Don't let the flame go out! Today's daily test saves your ${st}-day streak.`
      : secs ? `${mins} down, ${goal - mins} to go. You've got this!`
      : st ? `Day ${st + (lit ? 0 : 1)}! Ready for today's session?` : "Hi! I'm Kip. Let's warm up those fingers!";
    $('#streakBest').textContent = Math.max(st, C.longestStreak(qualified()));
    const next = MILESTONES.find(m => m > st);
    $('#streakNext').textContent = next ? `Next milestone: ${next} days` : '';

    const has = db.sessions.length > 0, b = baseline(), lv = C.level(b), bst = bestTest();
    $('#speedNow').textContent = has ? Math.round(b) : '–';
    requestAnimationFrame(() => { $('#speedFill').style.width = (has ? Math.min(100, b) : 0) + '%'; });
    $('#speedBest').style.left = `calc(${Math.min(100, bst)}% - 2px)`;
    $('#speedBest').hidden = !bst;
    $('#speedLevel').textContent = !has ? 'Your first daily test sets your starting speed.'
      : b >= C.GOAL ? `Level ${lv.n}: ${lv.name}. You made it to 100!`
      : `Level ${lv.n}: ${lv.name}. ${Math.max(1, Math.ceil(lv.to - b))} wpm to the next level.`;
    const lt = tests().slice(-1)[0];
    $('#lastTest').hidden = !lt;
    if (lt) {
      const ago = C.dayNumber(todayKey()) - C.dayNumber(C.dateKey(new Date(lt.t)));
      const when = ago === 0 ? 'today' : ago === 1 ? 'yesterday' : new Date(lt.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      $('#lastTest').innerHTML = `Last test <b>${Math.round(lt.wpm)} wpm</b> · <b>${Math.round(lt.acc * 100)}%</b> · ${when}`;
    }
    $('#tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  // ---------- typing engine ----------
  // Every key fills one position. Wrong keys turn red and must be deleted with Backspace.
  let run = null, raf = 0, resultAt = 0, hintTimer = 0;
  let flow = { results: [] };
  const practice = { secs: '60', pool: 'all', pace: '1.05' };
  const START_HINT = 'Start typing. The timer begins on your first key. Mistakes turn red: press Backspace to fix them.';

  function poolWords(pool) {
    if (pool === 'easy') return { words: EASY, focus: [] };
    if (pool === 'weak') return { words: WORDS, focus: C.weakKeys(db.keys, 3) };
    return { words: WORDS, focus: [] };
  }
  function setHint(text, warn, tone) {
    clearTimeout(hintTimer);
    $('#hint').textContent = text;
    $('#hint').className = 'hint' + (warn ? ' warn' : tone ? ' ' + tone : '');
    if (warn) hintTimer = setTimeout(() => setHint(''), 1800);
  }

  let recentQs = [];
  function pickQuestion() {
    const pool = QUESTIONS.filter(q => !recentQs.includes(q));
    const q = pool[Math.floor(Math.random() * pool.length)];
    recentQs = recentQs.concat(q).slice(-8);
    return q;
  }

  function startRun(opts) {
    cancelAnimationFrame(raf);
    const free = !!opts.free;
    const src = free ? null : poolWords(opts.pool);
    const track = $('#track');
    run = { opts, src, free, text: '', spans: [], pos: 0, reds: new Set(), ever: new Set(), tried: new Set(), wordClean: true,
      ans: '', question: free ? pickQuestion() : '',
      keys: 0, wrong: 0, start: 0, last: 0, combo: 0, maxCombo: 0, ended: false,
      paceIdx: -1, lastHud: 0, shift: 0, lh: 0, curEl: null };
    track.innerHTML = ''; track.style.transform = '';
    $('#question').hidden = !free;
    if (free) {
      // Free type: no text to copy. Your own answer appears as you type.
      $('#questionText').textContent = run.question + '?';
      track.innerHTML = '<span class="ans"></span><span class="c ans-cur">&nbsp;</span>';
      run.ansEl = track.firstChild;
      run.spans = [track.lastChild];
    } else {
      appendWords(Math.max(40, Math.ceil(opts.secs * 2.6)));
    }

    let desc = opts.desc || '';
    if (free) desc = 'Type your answer in your own words: lowercase letters and spaces. Every letter you delete counts as a mistake.';
    if (opts.pool === 'weak') desc += src.focus.length ? ` Focus letters: ${src.focus.join(', ')}.` : ' Still learning your weak spots, so mixed words for now.';
    if (opts.pace) desc += ` Pace car: ${opts.pace} wpm.`;
    $('#tStep').textContent = opts.label;
    $('#tTitle').textContent = opts.title;
    $('#tDesc').textContent = desc;
    $('#hPaceBox').hidden = !opts.pace;
    $('#hPaceBox').className = '';
    $('#hPace').textContent = '0';
    $('#hPaceLbl').textContent = 'vs pace car';
    $('#hTime').textContent = opts.secs;
    $('#hWpm').textContent = '–';
    $('#hAcc').textContent = '100';
    $('#hCombo').textContent = '0';
    $('#hComboBox').className = 'combo';
    $('#timeFill').style.transform = 'scaleX(1)';
    $('#timeFill').className = '';
    $('#hTime').parentElement.className = 'hud-time';
    setAccent($('#type'), opts.color || PRACTICE_COLOR);
    $('#typebox').classList.remove('typing', 'hot', 'fire');
    $('#caps').hidden = true;
    $('#guideKb').hidden = !db.settings.guide;
    setHint(free ? 'Start typing your answer. The timer begins on your first key.' : START_HINT);
    if (view !== 'type') show('type');
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
    if (run.curEl) run.curEl.classList.remove('cur');
    const cur = run.curEl = run.spans[run.pos];
    cur.classList.add('cur');
    // Keep the current line as the 1st or 2nd visible line.
    const line = Math.round(cur.offsetTop / run.lh);
    const shift = Math.max(0, line - 1) * run.lh;
    if (shift !== run.shift) { run.shift = shift; $('#track').style.transform = `translateY(${-shift}px)`; }
    if (db.settings.guide) {
      for (const k in guideMap) guideMap[k].classList.remove('next');
      const g = guideMap[run.reds.size || run.free ? null : run.text[run.pos]];
      if (g) g.classList.add('next');
    }
  }

  // Free type: any letter or space is accepted; deleting letters is what costs accuracy.
  function freeKey(k) {
    if (k === ' ' && (!run.ans || run.ans.endsWith(' '))) return; // no leading or double spaces
    startClock();
    run.keys++;
    run.ans += k;
    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    flashKey(k, true);
    beep('hit');
    run.ansEl.textContent = run.ans;
    setCurrent();
    if (COMBO_SHOUTS[run.combo]) comboShout(COMBO_SHOUTS[run.combo]);
    updateCombo(true);
  }
  function freeBack(word) {
    if (!run.ans) return;
    const cut = word ? run.ans.match(/(\S+\s*|\s+)$/)[0] : run.ans.slice(-1);
    run.ans = run.ans.slice(0, -cut.length);
    const letters = cut.replace(/\s/g, '').length;
    run.wrong += letters;
    if (letters) { run.combo = 0; updateCombo(false); }
    run.ansEl.textContent = run.ans;
    setCurrent();
  }
  function startClock() {
    if (run.start) return;
    const now = performance.now();
    run.start = now; run.last = now;
    $('#typebox').classList.add('typing');
    setHint('');
    raf = requestAnimationFrame(tick);
  }
  function updateCombo(ok) {
    const cb = $('#hCombo');
    cb.textContent = run.combo;
    if (ok) restartAnim(cb, 'bump');
    const heat = run.combo >= 60 ? 'fire' : run.combo >= 25 ? 'hot' : '';
    $('#hComboBox').className = 'combo' + (heat ? ' ' + heat : '');
    $('#typebox').classList.toggle('hot', heat === 'hot');
    $('#typebox').classList.toggle('fire', heat === 'fire');
  }
  // Letters that count toward speed: correct ones in drills, everything kept in free type.
  const goodChars = () => run.free ? run.ans.trim().length : run.pos - run.reds.size;

  function shake() {
    const box = $('#typebox');
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }

  function typeKey(key, capsOn) {
    $('#caps').hidden = !capsOn;
    const k = key.toLowerCase();
    if (run.free) { freeKey(k); return; }
    // With a red letter pending you can finish the word, but not move past it.
    if (run.reds.size) {
      const first = Math.min(...run.reds);
      if (k === ' ' || run.text[run.pos] === ' ' || run.pos - first >= 6) {
        shake(); beep('miss');
        mood('#kipType', 'oops', 600);
        setHint('Fix the red letter first: press Backspace.', true);
        return;
      }
    }
    const now = performance.now();
    startClock();
    const exp = run.text[run.pos], span = run.spans[run.pos], ok = k === exp;
    run.keys++;
    if (!run.tried.has(run.pos)) {
      // Letter stats use the first attempt at each position only.
      run.tried.add(run.pos);
      const dt = now - run.last;
      if (exp !== ' ') C.recordKey(db.keys, exp, !ok, ok && dt < 2000 ? dt : null);
    }
    flashKey(k, ok);
    if (ok) {
      span.className = 'c ok pop' + (run.ever.has(run.pos) ? ' fixed' : '');
      run.combo++;
      run.maxCombo = Math.max(run.maxCombo, run.combo);
      beep('hit');
      if (exp === ' ') {
        // Finished a word without any mistakes: little sparkle.
        if (run.wordClean) { const b = span.getBoundingClientRect(); burst(b.left, b.top + b.height / 2, 5, [run.opts.color ? run.opts.color[0] : PRACTICE_COLOR[0], '#ffd43b'], 26); }
        run.wordClean = true;
      }
      if (COMBO_SHOUTS[run.combo]) comboShout(COMBO_SHOUTS[run.combo]);
    } else {
      span.className = 'c bad';
      run.reds.add(run.pos); run.ever.add(run.pos);
      run.wrong++; run.combo = 0; run.wordClean = false;
      shake(); beep('miss');
      mood('#kipType', 'oops', 600);
    }
    run.pos++; run.last = now;
    if (run.pos > run.text.length - 60) appendWords(30);
    setCurrent();
    updateCombo(ok);
  }

  // Press animation on the on-screen keyboard: green for right, red for wrong.
  function flashKey(k, ok) {
    if (!db.settings.guide) return;
    const el = guideMap[k];
    if (!el) return;
    el.classList.remove('hit', 'miss');
    el.classList.add(ok ? 'hit' : 'miss');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('hit', 'miss'), 140);
  }

  function comboShout(text) {
    const el = $('#comboPop');
    el.textContent = text;
    restartAnim(el, 'go');
    mood('#kipType', 'happy', 700);
    const b = run.curEl.getBoundingClientRect();
    burst(b.left, b.top + b.height / 2, 18, CONFETTI, 90);
  }

  // Backspace deletes one letter; Ctrl+Backspace deletes back to the start of the word.
  function backspace(word) {
    if (run.free) { freeBack(word); return; }
    if (!run.pos) return;
    do {
      run.pos--;
      run.spans[run.pos].className = 'c';
      run.reds.delete(run.pos);
    } while (word && run.pos > 0 && run.text[run.pos - 1] !== ' ');
    setCurrent();
  }

  function tick() {
    if (!run || run.ended) return;
    const now = performance.now(), el = now - run.start, total = run.opts.secs * 1000;
    if (el >= total) { finish(); return; }
    if (now - run.lastHud > 100) {
      run.lastHud = now;
      $('#hTime').textContent = Math.ceil((total - el) / 1000);
      $('#hWpm').textContent = el > 1500 ? Math.round(C.wpm(goodChars(), el)) : '–';
      $('#hAcc').textContent = Math.round(C.accuracy(run.keys - run.wrong, run.keys) * 100);
    }
    const left = 1 - el / total, secsLeft = (total - el) / 1000;
    $('#timeFill').style.transform = `scaleX(${left})`;
    $('#timeFill').className = left < 0.12 ? 'crit' : left < 0.3 ? 'low' : '';
    $('#hTime').parentElement.className = 'hud-time' + (secsLeft <= 5 && total >= 15000 ? ' crit' : '');
    if (run.opts.pace) {
      const idx = Math.min(run.spans.length - 1, Math.floor((run.opts.pace * 5 / 60000) * el));
      if (idx !== run.paceIdx) {
        if (run.paceIdx >= 0) run.spans[run.paceIdx].classList.remove('pace');
        run.spans[idx].classList.add('pace');
        run.paceIdx = idx;
        const diff = run.pos - idx;
        $('#hPace').textContent = (diff >= 0 ? '+' : '−') + Math.abs(diff);
        $('#hPaceLbl').textContent = diff >= 0 ? 'letters ahead' : 'letters behind';
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
      wpm: Math.round(C.wpm(goodChars(), ms) * 10) / 10,
      acc: Math.round(C.accuracy(run.keys - run.wrong, run.keys) * 1000) / 1000,
      combo: run.maxCombo };
    const counted = run.keys >= 5;
    const wasLit = todayLit(), prevBest = bestTest();
    let blockDone = false, dayDone = false;
    if (counted) {
      db.sessions.push(r);
      if (db.sessions.length > MAX_SESSIONS) db.sessions.splice(0, db.sessions.length - MAX_SESSIONS);
      addToDay(db.days, r, true);
      flow.results.push(r);
      if (o.mode === 'plan') {
        const p = plan();
        p.round++;
        if (p.round >= blocks()[p.block].rounds.length) { p.block++; p.round = 0; blockDone = true; }
        if (planDone()) { dayDone = true; db.days[todayKey()].perfect = true; }
      }
    }
    save();
    renderChrome();

    const party = [];
    if (counted && !wasLit && todayLit()) party.push('streak');
    if (dayDone) party.push('perfect');
    const pb = counted && r.test && r.wpm > prevBest;

    // Every round ends on the result screen; you confirm before the next one starts.
    showResult(r, counted, pb, prevBest, blockDone, dayDone);
    if (pb) confetti();
    celebrate(party);
  }

  function showResult(r, counted, pb, prevBest, blockDone, dayDone) {
    const o = run.opts;
    // Mid-block: this round's numbers. End of a block: the block's averages.
    const rs = blockDone ? flow.results : counted ? [r] : [];
    const last = rs[rs.length - 1];
    const w = rs.length ? avg(rs.map(x => x.wpm)) : 0, a = rs.length ? avg(rs.map(x => x.acc)) : 1;
    const bl = blocks(), p = plan();
    const roundsInBlock = o.mode === 'plan' ? bl.find(b => b.title === o.title).rounds.length : 1;
    $('#rStep').textContent = o.mode !== 'plan' ? 'Practice' : blockDone ? `Block ${Math.min(p.block, bl.length)} of ${bl.length} done` : o.label;
    $('#rTitle').textContent = dayDone ? "You finished today's session!" : blockDone ? `${o.title} complete`
      : o.mode !== 'plan' ? o.title : counted ? `Round ${p.round} of ${roundsInBlock} done` : 'Round not counted';
    setAccent($('#resultCard'), o.color || PRACTICE_COLOR);
    // Stars: 1 for finishing, 1 for 95%+ accuracy, 1 for beating the pace car (or 98%+ when there is none).
    const stars = !rs.length ? 0 : 1 + (a >= 0.95 ? 1 : 0) + ((last.pace ? w >= last.pace : a >= 0.98) ? 1 : 0);
    const starEls = [...document.querySelectorAll('#rStars .star')];
    starEls.forEach(s => s.classList.remove('on'));
    $('#rStars').setAttribute('aria-label', `${stars} of 3 stars`);
    starEls.slice(0, stars).forEach((s, i) => setTimeout(() => {
      s.classList.add('on');
      const b = s.getBoundingClientRect();
      burst(b.left + b.width / 2, b.top + b.height / 2, 10, ['#f5b300', '#ffd43b', '#ff8a00'], 50);
    }, 350 + i * 300));
    setTimeout(() => mood('#kipResult', stars >= 2 ? 'happy' : 'oops', 900), 300);

    const notes = [];
    if (!counted) notes.push('Too few keys pressed, so this round was not recorded.');
    if (o.free && counted) {
      const words = run.ans.trim().split(/\s+/).length;
      notes.push(`<span class="answer"><b>${esc(run.question)}?</b><br>"${esc(run.ans.trim())}"</span>`);
      notes.push(`${words} word${words > 1 ? 's' : ''}. You deleted ${run.wrong} letter${run.wrong === 1 ? '' : 's'}: accuracy counts every letter you had to take back.`);
    }
    if (pb) notes.push(prevBest ? `<b>New personal best!</b> ${last.wpm.toFixed(1)} wpm, up ${(last.wpm - prevBest).toFixed(1)} on your old record.` : '<b>First test recorded.</b> This is your starting line.');
    if (last && last.pace) notes.push(w >= last.pace ? `You beat the pace car (${last.pace} wpm).` : `The pace car was ${last.pace} wpm. ${Math.ceil(last.pace - w)} to go.`);
    if (o.goalAcc) notes.push(a >= o.goalAcc ? 'Precision target hit. That is how speed gets built.' : `Accuracy was under ${Math.round(o.goalAcc * 100)}%. Slow down until it is clean.`);
    else if (rs.length && a < 0.92) notes.push('Accuracy under 92%. Slow down a little: every fix costs more time than a careful keystroke.');
    if (blockDone && !dayDone) notes.push('Good moment for a short break: shake out your hands and look away from the screen.');
    if (dayDone) notes.push("That was today's whole session. Come back tomorrow for a fresh one and keep your streak going.");
    $('#rNote').innerHTML = notes.join('<br>');

    $('#rNext').firstChild.textContent = o.mode !== 'plan' ? 'Again '
      : dayDone ? 'See progress '
      : blockDone ? `Next: ${bl[p.block].title} `
      : counted ? `Next round (${p.round + 1} of ${roundsInBlock}) ` : 'Try again ';
    show('result');
    countUp($('#rWpm'), Math.round(w));
    countUp($('#rAcc'), Math.round(a * 100));
    countUp($('#rCombo'), rs.reduce((m, x) => Math.max(m, x.combo), 0));
    if (blockDone && !pb) confetti(true);
    resultAt = performance.now();
  }

  function startRound() {
    const p = plan(), bl = blocks();
    if (p.round === 0) flow = { results: [] };
    const b = bl[p.block], r = b.rounds[p.round];
    startRun(Object.assign({}, r, { mode: 'plan', title: b.title, desc: b.desc, color: BLOCK_COLORS[b.id],
      label: `Block ${p.block + 1} of ${bl.length} · Round ${p.round + 1} of ${b.rounds.length}` }));
  }
  function startHour() {
    if (planDone()) { show('practice'); return; }
    flow = { results: [] };
    startRound();
  }
  function startPractice() {
    flow = { results: [] };
    const p = Number(practice.pace), secs = Number(practice.secs), free = practice.pool === 'free';
    startRun({ mode: 'practice', title: free ? 'Free type' : 'Free practice', label: 'Practice', secs, pool: practice.pool, free,
      pace: p && !free ? Math.round(baseline() * p) : 0, test: practice.pool === 'all' && secs >= 60 });
  }
  function next() {
    if (!run || run.opts.mode !== 'plan') startPractice();
    else if (planDone()) show('progress');
    else startRound();
  }
  function pause() {
    const mid = run && run.opts.mode === 'plan';
    show('home');
    if (mid) toast("Paused. Your place in today's session is saved.");
  }

  // ---------- celebrations (streak / perfect day) ----------
  let queue = [], overlayAt = 0;
  function celebrate(items) { queue.push(...items); if ($('#overlay').hidden) nextOverlay(); }
  function nextOverlay() {
    const item = queue.shift();
    if (!item) { $('#overlay').hidden = true; return; }
    const card = $('.ov-card'), st = streakNow();
    card.classList.toggle('gold', item === 'perfect');
    $('#ovIcon use').setAttribute('href', item === 'perfect' ? '#crown' : '#flame');
    if (item === 'perfect') $('#ovNum').textContent = '';
    else setTimeout(() => countUp($('#ovNum'), st), 150);
    setTimeout(() => {
      const b = $('#ovIcon').getBoundingClientRect();
      burst(b.left + b.width / 2, b.top + b.height / 2, 24, item === 'perfect' ? ['#f5b300', '#ffd43b', '#fff3bf'] : ['#ff8a00', '#ffd43b', '#f03e3e'], 110);
    }, 200);
    if (item === 'perfect') {
      $('#ovTitle').textContent = 'Perfect day!';
      $('#ovText').textContent = "You finished today's whole session. This is how 100 WPM happens.";
    } else {
      $('#ovTitle').textContent = st === 1 ? 'You started a streak!' : `${st} day streak!`;
      $('#ovText').textContent = MILESTONES.includes(st) ? `${st} days in a row. That is a milestone. Keep it burning.` : 'Your flame is lit for today. Come back tomorrow to keep it going.';
    }
    renderWeek($('#ovWeek'));
    $('#overlay').hidden = false;
    overlayAt = performance.now();
    $('#ovBtn').focus();
    if (item === 'perfect' || MILESTONES.includes(st)) confetti();
  }
  $('#ovBtn').addEventListener('click', nextOverlay);

  // ---------- progress ----------
  let chart = null;
  function renderProgress() {
    const keys = Object.keys(db.days).sort();
    const testDays = keys.filter(k => db.days[k].best > 0);
    $('#pCur').textContent = tests().length ? Math.round(baseline()) : '–';
    $('#pBest').textContent = bestTest() ? Math.round(bestTest()) : '–';
    $('#pTime').textContent = (keys.reduce((a, k) => a + (db.days[k].ms || 0), 0) / 3600000).toFixed(1);

    const eta = C.projectDays(testDays.slice(-30).map(k => ({ x: C.dayNumber(k), y: db.days[k].best })), C.GOAL);
    if (eta === null) { $('#pEta').textContent = '–'; $('#pEtaSub').textContent = testDays.length < 3 ? 'needs 3+ test days' : 'trend not rising yet, keep going'; }
    else if (eta === 0) { $('#pEta').textContent = 'Done!'; $('#pEtaSub').textContent = 'goal reached'; }
    else {
      const when = new Date(); when.setDate(when.getDate() + eta);
      $('#pEta').textContent = when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      $('#pEtaSub').textContent = `about ${eta} days at your current trend`;
    }

    $('#chartEmpty').hidden = testDays.length > 0;
    if (chart) { chart.destroy(); chart = null; }
    if (window.Chart && testDays.length) {
      const vals = testDays.map(k => db.days[k].best);
      const avg7 = vals.map((_, i) => Math.round(avg(vals.slice(Math.max(0, i - 6), i + 1)) * 10) / 10);
      chart = new window.Chart($('#chart').getContext('2d'), {
        type: 'line',
        data: { labels: testDays.map(k => k.slice(5)), datasets: [
          { label: 'Daily test', data: vals, borderColor: '#3b5bdb', backgroundColor: 'rgba(59,91,219,.08)', fill: true, tension: 0.3, borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderWidth: 2.5 },
          { label: '7-day average', data: avg7, borderColor: '#ff8a00', borderDash: [6, 4], borderWidth: 2.5, pointRadius: 0, tension: 0.3 },
          { label: 'Goal', data: vals.map(() => C.GOAL), borderColor: '#b9b2a5', borderWidth: 1.5, pointRadius: 0, borderDash: [2, 4] },
        ] },
        options: {
          maintainAspectRatio: false, animation: reducedMotion ? false : { duration: 700 },
          interaction: { mode: 'index', intersect: false },
          scales: {
            y: { min: 0, suggestedMax: 110, grid: { color: '#efebe3' }, ticks: { color: '#857f75' } },
            x: { grid: { display: false }, ticks: { color: '#857f75', maxRotation: 0, autoSkip: true } },
          },
          plugins: { legend: { labels: { color: '#2d2a26', boxWidth: 12, font: { family: 'Nunito', weight: '700' } } } },
        },
      });
    } else if (!window.Chart && testDays.length) {
      $('#chartEmpty').hidden = false;
      $('#chartEmpty').textContent = 'The chart library did not load (offline?). Your data is safe.';
    }

    const heat = buildKb($('#heatKb'));
    const known = C.LETTERS.split('').filter(k => db.keys[k] && db.keys[k].n >= 5 && db.keys[k].ms > 0);
    const avgMs = known.length ? avg(known.map(k => db.keys[k].ms)) : 0;
    for (const ch of C.LETTERS) {
      const el = heat[ch], s = db.keys[ch];
      if (!s || s.n < 5 || !s.ms) { el.classList.add('none'); el.title = `${ch}: not enough data yet`; continue; }
      const bad = Math.min(1, s.err / 0.15) * 0.6 + Math.min(1, Math.max(0, s.ms / avgMs - 0.8) / 0.8) * 0.4;
      el.style.background = `hsl(${Math.round(130 * (1 - bad))} 65% 78%)`;
      el.style.borderColor = `hsl(${Math.round(130 * (1 - bad))} 45% 58%)`;
      el.title = `${ch}: ${Math.round(s.err * 100)}% missed · ${Math.round(s.ms)} ms · ${s.n} presses`;
    }
    heat[' '].classList.add('none');
    const weak = C.weakKeys(db.keys, 3);
    $('#weakList').textContent = weak.length ? weak.join(', ') : 'type a bit more to find out';

    const cal = $('#cal'); cal.innerHTML = '';
    const now = new Date(), start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 15 * 7);
    for (const d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const k = C.dateKey(d), day = db.days[k], m = ((day && day.ms) || 0) / 60000;
      const i = document.createElement('i');
      i.className = (day && day.perfect ? 'gold' : m === 0 ? '' : m < 5 ? 'l1' : m < 12 ? 'l2' : 'l3') + (k === todayKey() ? ' today' : '');
      i.title = `${k}: ${Math.round(m)} min`;
      cal.appendChild(i);
    }

    const rows = db.sessions.slice(-15).reverse().map(s => {
      const when = new Date(s.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return `<tr><td>${when}</td><td>${esc(s.title)}${s.test ? ' (test)' : ''}</td><td class="num">${Math.round(s.wpm)}</td><td class="num">${Math.round(s.acc * 100)}%</td><td class="num">${s.secs}s</td></tr>`;
    });
    $('#runs tbody').innerHTML = rows.join('') || '<tr><td colspan="5" class="muted">No rounds yet.</td></tr>';
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- events ----------
  document.addEventListener('keydown', e => {
    if (!$('#overlay').hidden) {
      if ((e.key === 'Enter' || e.key === 'Escape') && performance.now() - overlayAt > 600) { e.preventDefault(); nextOverlay(); }
      else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') e.preventDefault();
      return;
    }
    if (view === 'type' && run && !run.ended) {
      if (e.key === 'Escape') { e.preventDefault(); pause(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); backspace(e.ctrlKey || e.altKey || e.metaKey); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 || !/[a-zA-Z ]/.test(e.key)) return;
      e.preventDefault();
      typeKey(e.key, e.getModifierState && e.getModifierState('CapsLock'));
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('button, input, label, a, select, textarea')) return;
    if (e.key === 'Enter') {
      if (view === 'home') { e.preventDefault(); startHour(); }
      else if (view === 'practice') { e.preventDefault(); startPractice(); }
      // Ignore Enter right after a round ends, so a stray key doesn't skip the result.
      else if (view === 'result' && performance.now() - resultAt > 500) { e.preventDefault(); next(); }
    }
    if (e.key === 'Escape' && view === 'result') show('home');
  });

  // Font size follows window width, so re-measure lines if the window is resized mid-round.
  window.addEventListener('resize', () => {
    if (!run || run.ended || view !== 'type') return;
    run.lh = parseFloat(getComputedStyle($('#track')).lineHeight) || run.lh;
    run.shift = -1;
    setCurrent();
  });

  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => show(b.dataset.go)));
  $('#startHour').addEventListener('click', startHour);
  $('#startPractice').addEventListener('click', startPractice);
  $('#quit').addEventListener('click', pause);
  $('#rNext').addEventListener('click', next);
  $('#rHome').addEventListener('click', () => show('home'));

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
    e.target.blur(); // so the next space types instead of toggling the box
    if (run && !run.ended) setCurrent();
  });
  $('#optSound').addEventListener('change', e => { db.settings.sound = e.target.checked; save(); e.target.blur(); });

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
      if (!confirm(`Replace your current progress with this backup (${d.sessions.length} rounds)?`)) return;
      db = migrate(d); save(); renderChrome(); renderProgress(); toast('Backup restored.');
    };
    rd.onerror = () => toast('Could not read that file.');
    rd.readAsText(f);
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('Delete ALL your progress? This cannot be undone. Export a backup first if unsure.')) return;
    db = blank(); save(); renderChrome(); renderProgress(); toast('Progress reset.');
  });

  show('home');
})();
