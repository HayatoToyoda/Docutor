#!/usr/bin/env node
// End-to-end smoke test for Docutor.
//
// Exercises the core "upload -> review -> edit -> accept -> export" flow
// against a running instance of the app:
//   1. Open the app and start from the sample document.
//   2. Select the diagram section and edit its mermaid source.
//   3. Accept every section (demo sections carry no TODO/Unclear markers,
//      so the two-click confirm path is never triggered here).
//   4. Download the Markdown export and assert the edit made it through.
//   5. Assert the "Complete review" button is enabled once everything is
//      accepted.
//
// Usage:
//   SMOKE_BASE_URL=http://localhost:3000 node scripts/smoke.mjs
//
// Env vars:
//   SMOKE_BASE_URL           Base URL of the running app (default http://localhost:3000).
//   DOCUTOR_SMOKE_CHROMIUM   Optional path to a Chromium executable. When
//                            unset, Playwright's bundled/managed browser is
//                            used.

import { chromium } from "playwright";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const MARKER = "MARKER_EDITED_BY_SMOKE_TEST";

function fail(message) {
  console.error(`SMOKE TEST FAILED: ${message}`);
  process.exit(1);
}

async function main() {
  const downloadDir = await mkdtemp(path.join(tmpdir(), "docutor-smoke-"));

  const launchOptions = {};
  if (process.env.DOCUTOR_SMOKE_CHROMIUM) {
    launchOptions.executablePath = process.env.DOCUTOR_SMOKE_CHROMIUM;
  }

  const browser = await chromium.launch(launchOptions);
  let hasMarker = false;
  let completeDisabled = true;

  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("[pageerror]", err.message));

    await page.goto(BASE_URL);
    await page.getByRole("button", { name: /Try with a sample document/i }).click();
    await page.waitForURL(/\/review\//, { timeout: 15000 });
    console.log("On review page:", page.url());

    // Select the diagram section from the sidebar.
    await page.getByRole("button", { name: /Document conversion workflow/i }).click();

    // Edit the diagram source textarea.
    const textarea = page.locator("textarea").first();
    await textarea.waitFor({ state: "visible" });
    const original = await textarea.inputValue();
    console.log("Original mermaid code:\n", original);

    const edited = `${original}\n  ${MARKER} --> END`;
    await textarea.fill(edited);
    await textarea.blur();
    await page.waitForTimeout(500);

    // Accept the diagram section.
    await page.getByRole("button", { name: /Accept/i }).click();
    await page.waitForTimeout(300);

    // Accept every remaining section so "Complete review" becomes enabled.
    // Demo sections carry no TODO/Unclear markers, so the two-click confirm
    // flow is never triggered here.
    const sectionButtons = await page.locator("aside button").all();
    for (const btn of sectionButtons) {
      await btn.click();
      await page.waitForTimeout(150);
      const acceptBtn = page.getByRole("button", { name: /^✓ Accept$/ });
      if (await acceptBtn.count()) {
        await acceptBtn.click();
        await page.waitForTimeout(150);
      }
    }

    // Download the Markdown export and inspect its contents for the edited
    // marker.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /Download Markdown/i }).click(),
    ]);
    const downloadPath = path.join(downloadDir, "document.md");
    await download.saveAs(downloadPath);
    console.log("Downloaded to", downloadPath);

    const content = await readFile(downloadPath, "utf8");
    console.log("----- exported markdown -----");
    console.log(content);
    console.log("------------------------------");

    hasMarker = content.includes(MARKER);
    console.log("Contains edited marker:", hasMarker);

    // Verify the completion button is now enabled.
    const completeBtn = page.getByRole("button", { name: /Complete review/i });
    completeDisabled = await completeBtn.isDisabled();
    console.log("Complete review disabled:", completeDisabled);
  } finally {
    await browser.close();
    await rm(downloadDir, { recursive: true, force: true });
  }

  if (!hasMarker) {
    fail("edited mermaid code was not present in the exported Markdown.");
  }
  if (completeDisabled) {
    fail("Complete review button is still disabled after all sections were reviewed.");
  }

  console.log("SMOKE TEST PASSED");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err?.stack ?? err);
  process.exit(1);
});
