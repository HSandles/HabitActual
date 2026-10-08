# HabitActual

A habit and challenge tracker for your phone. Use it for 75 Hard, 75 Soft or any goal of your own.

- **Everything stays on your device.** There are no accounts and no server; data is kept in the browser's IndexedDB.
- **Installable and works offline.** It's a PWA, so add it to your home screen.
- **Challenges:** a list of daily tasks, a length in days (or ongoing) and a start date.
- **Optional strict mode:** missing a day sends you back to day 1, as in the official 75 Hard rules. When it's off, a missed day only breaks your streak.
- **Reminders** are added to your phone's own calendar (an .ics file or a Google Calendar link).
- **Backups:** export and import JSON from Settings.

## Development

```sh
npm install
npm run dev      # dev server, also reachable from your phone on the same Wi-Fi
npm test         # unit tests for the challenge/streak logic
npm run build    # production build in dist/
```

## Deploying

Each push to `main` runs `.github/workflows/deploy.yml`, which tests and builds the app and then publishes it to GitHub Pages at `https://<user>.github.io/HabitActual/`.

One-time setup: in the repo on GitHub, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.

## Installing on your phone

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ → Add to Home screen / Install app
