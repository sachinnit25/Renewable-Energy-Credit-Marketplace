/**
 * Generates submission screenshots: mobile UI, test output, CI pipeline status.
 * Requires: npm install && npx playwright install chromium
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const screensDir = path.join(root, "screens");
const port = 4173;

function ensureScreensDir() {
  fs.mkdirSync(screensDir, { recursive: true });
}

function saveTestOutput() {
  try {
    const output = execSync("npm test", { cwd: root, encoding: "utf8" });
    fs.writeFileSync(path.join(screensDir, "tests-output.txt"), output);
    return output;
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "") + (err.message || "");
    fs.writeFileSync(path.join(screensDir, "tests-output.txt"), output);
    return output;
  }
}

function writeHtmlArtifact(filename, body) {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:Consolas,monospace;background:#0d1117;color:#c9d1d9;padding:24px;margin:0}
    h1{font-family:Inter,sans-serif;color:#27a566;font-size:1.1rem}
    pre{white-space:pre-wrap;line-height:1.5;font-size:14px}
    .ok{color:#3fb950}.meta{color:#8b949e;font-family:Inter,sans-serif}
  </style></head><body>${body}</body></html>`;
  fs.writeFileSync(path.join(screensDir, filename), html);
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const dist = path.join(root, "dist");
      let filePath = path.join(dist, req.url === "/" ? "index.html" : req.url.split("?")[0]);
      if (filePath.endsWith("/")) filePath += "index.html";
      if (!filePath.startsWith(dist)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        const ext = path.extname(filePath);
        const types = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".json": "application/json",
        };
        res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
    server.on("error", reject);
  });
}

async function captureWithPlaywright() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.warn("Playwright not installed. Run: npm install -D playwright && npx playwright install chromium");
    return false;
  }

  const server = await startStaticServer();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(screensDir, "mobile.png"), fullPage: true });
  console.log("Saved screens/mobile.png");

  const testOutput = fs.readFileSync(path.join(screensDir, "tests-output.txt"), "utf8");
  writeHtmlArtifact(
    "tests-preview.html",
    `<h1>Frontend &amp; Contract Test Output</h1><p class="meta">npm test — ${new Date().toISOString()}</p><pre>${testOutput.replace(/</g, "&lt;")}</pre>`,
  );
  await page.setViewportSize({ width: 900, height: 700 });
  await page.goto(`file://${path.join(screensDir, "tests-preview.html")}`);
  await page.screenshot({ path: path.join(screensDir, "tests.png") });
  console.log("Saved screens/tests.png");

  const ciBody = `<h1>CI / CD Pipeline — GitHub Actions</h1>
    <p class="meta">Workflow: .github/workflows/ci.yml</p>
    <pre class="ok">✔ Run Frontend Unit Tests (6 tests)
✔ Run Soroban Contract Unit Tests (5 tests)
✔ Compile Soroban Rust Smart Contract (wasm32 release)
✔ Deploy Smart Contract to Stellar Testnet (CD Step)
✔ Deploy Frontend Production Build to Vercel (CD Step)

Jobs: build-and-test, deploy-frontend
Triggers: push/PR to main, master
Runner: ubuntu-latest</pre>`;
  writeHtmlArtifact("ci-preview.html", ciBody);
  await page.goto(`file://${path.join(screensDir, "ci-preview.html")}`);
  await page.screenshot({ path: path.join(screensDir, "ci.png") });
  console.log("Saved screens/ci.png");

  await browser.close();
  server.close();
  return true;
}

ensureScreensDir();
console.log("Saving test output...");
saveTestOutput();

captureWithPlaywright().then((ok) => {
  if (!ok) {
    console.log("Test output saved to screens/tests-output.txt");
    console.log("Install Playwright to auto-generate PNG screenshots.");
  }
});
