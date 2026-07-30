Screenshots and artifacts

Place screenshots in this folder with the following filenames before submission:
- `mobile.png` — screenshot showing the app in a narrow/mobile viewport.
- `ci.png` — screenshot of GitHub Actions (CI) run showing tests passing.
- `tests.png` — terminal output showing `npm test` with 3+ passing tests.

## Generate automatically

```bash
npm install -D playwright
npx playwright install chromium
npm run capture-screenshots
```

This saves `mobile.png`, `ci.png`, `tests.png`, and `tests-output.txt`.

## Manual capture
- Mobile screenshot: open `frontend/index.html` in browser, open devtools → Toggle device toolbar → choose a mobile preset → capture.
- CI screenshot: trigger a GitHub Actions run (push to branch) and screenshot the run page.
- Tests screenshot: run `npm test` and screenshot or save terminal output.
