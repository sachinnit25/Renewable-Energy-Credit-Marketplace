Demo video script (1–2 minutes)

1. Intro (5–8s): brief title slide "REC Marketplace — Demo" and your name.
2. Connect wallet (15s): show `frontend/index.html`, click "Connect Freighter", show wallet address and balance.
3. Create & purchase (30s): run `npx hardhat node` and `npx hardhat run scripts/deploy.js --network localhost`; then run `node scripts/interact.js` (with `.env` configured) to create a listing and purchase it; show terminal output and copy tx hashes.
4. CI & tests (20s): open GitHub Actions run (or run `npm test`) and show passing tests (3+). Capture terminal output screenshot.
5. Mobile responsive (10s): resize browser or emulate mobile and show the UI adapts; capture screenshot.
6. Closing (5s): point to repo URL and live demo link.

Recording tips:
- Use a screen recorder (e.g., OBS, QuickTime, Loom). Keep clips short and narrated.
- Highlight tx hashes and URLs in the video and include them in the video description.
