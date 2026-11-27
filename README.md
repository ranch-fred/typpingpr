# Road to 100

A daily touch-typing trainer to get from ~10 WPM to 100 WPM without looking at the keyboard.
Lowercase words only: no capitals, numbers or symbols. Built for a laptop or desktop keyboard.

## Use it

Open `index.html` in a browser, or turn on GitHub Pages (Settings → Pages → Deploy from branch → `main` / root)
and open the link it gives you every day.

## What's inside

- **Daily session**: 20 minutes of typing in 7 blocks (warm-up, precision, weak keys, sprints,
  free type, endurance, cool-down). Only time spent typing counts, and you can stop and resume any time that day.
  After every round you see your result and press Enter to go on.
- **Free type**: 3 questions a day that you answer in your own words. Graded on speed and accuracy, where every
  letter you delete counts as a mistake. Also available in Practice.
  It adapts to your current speed and to the letters you miss or hesitate on.
- **Red and green letters**: correct letters turn green, mistakes turn red. You must Backspace a mistake before
  moving past the word (Ctrl+Backspace deletes the whole word).
- **Streaks**: finish the warm-up (or type 15 minutes) each day to keep your streak. Finish the whole session for a gold "perfect day".
  Week view, best streak, milestones and celebrations.
- **Pace car**: an orange marker in every round. 20 wpm on day 1, a bit faster each day, 100 wpm on day 30.
- **Key guide** (optional): highlights the next key on screen, so you look at the screen and not your hands.
- **Progress**: a chart of every round with a line of best fit and averages, an estimated date for 100 WPM, a letter heatmap,
  a practice calendar and recent rounds.
- **Free practice**: extra rounds from 15 seconds to 5 minutes with the word set you choose.

Progress is stored in your browser (localStorage), and online automatically after every round, in one copy shared by every browser that opens the site.
Online saving needs Upstash Redis settings (UPSTASH_REDIS_REST_URL / _TOKEN) on the Vercel project, then a redeploy.
Saves are merged into the online copy, never replacing it. Anyone with the site address can add to it. Use **Export backup** on the Progress page now and then.

## Develop

No build step. `node test.js` runs the logic tests.
