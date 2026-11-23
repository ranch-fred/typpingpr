# Road to 100

A daily touch-typing trainer to get from ~10 WPM to 100 WPM without looking at the keyboard.
Lowercase words only: no capitals, numbers or symbols. Built for a laptop or desktop keyboard.

## Use it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root)
and open the link it gives you every day.

## What's inside

- **Daily hour**: 60 minutes of typing in 8 blocks (warm-up, daily test, precision, weak keys, sprints,
  endurance, weak keys II, cool-down). Only time spent typing counts, and you can stop and resume any time that day.
  It adapts to your current speed and to the letters you miss or hesitate on.
- **Red and green letters**: correct letters turn green, mistakes turn red. You must Backspace a mistake before
  moving past the word (Ctrl+Backspace deletes the whole word).
- **Streaks**: type 15 minutes a day to keep your streak. Finish the full hour for a gold "perfect day".
  Week view, best streak, milestones and celebrations.
- **Pace car**: an orange marker moving at a target speed just above yours. Stay ahead of it.
- **Key guide** (optional): highlights the next key on screen, so you look at the screen and not your hands.
- **Progress**: daily test chart with a 7-day average, an estimated date for 100 WPM, a letter heatmap,
  a practice calendar and recent rounds.
- **Free practice**: extra rounds from 15 seconds to 5 minutes with the word set and pace you choose.

Progress is stored in your browser (localStorage). Use **Export backup** on the Progress page now and then.

## Develop

No build step. `node test.js` runs the logic tests.
