# Road to 100

A daily touch-typing trainer to get from ~10 WPM to 100 WPM without looking at the keyboard.
Lowercase words only: no capitals, numbers or symbols.

## Use it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root)
and open the link it gives you every day.

## What's inside

- **Daily session (~7 min)**: warm-up → weak-key drill → precision run → 3 sprints → daily test.
  It adapts to your current speed and to the letters you miss or hesitate on.
- **Pace car**: a pink marker moving at a target speed just above yours. Stay ahead of it.
- **Stop on error**: a wrong key must be fixed before you move on, which trains accuracy first.
- **Key guide** (optional): highlights the next key on screen, so you look at the screen and not your hands.
- **Progress**: daily test chart with a 7-day average, an estimated date for 100 WPM, a letter heatmap,
  a practice calendar, streaks and personal bests.
- **Free practice**: extra runs of 15s to 2m with the word set and pace you choose.

Progress is stored in your browser (localStorage). Use **Export backup** on the Progress page now and then.

## Develop

No build step. `node test.js` runs the logic tests.
