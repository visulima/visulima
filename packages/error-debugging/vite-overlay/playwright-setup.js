// fallow-ignore-file unused-file -- standalone dev script run manually (`node playwright-setup.js`) to install Playwright browsers; not imported by any module
/**
 * Playwright setup script for error overlay e2e tests
 */

const { execSync } = require("node:child_process");

console.log("🚀 Setting up Playwright for Error Overlay E2E tests...\n");

try {
    console.log("📦 Installing Playwright browsers...");
    execSync("npx playwright install", { stdio: "inherit" });

    console.log("✅ Playwright setup complete!");
    console.log("\n📋 Available test commands:");
    console.log("  pnpm test:e2e          - Run all e2e tests");
    console.log("  pnpm test:e2e:ui       - Run tests with UI");
    console.log("  pnpm test:e2e:headed   - Run tests in headed mode");
    console.log("  pnpm test:e2e:debug    - Run tests in debug mode");
    console.log("\n🎯 Test files:");
    console.log("  e2e/error-overlay.spec.ts  - Basic overlay functionality");
    console.log("  e2e/cause-chain.spec.ts    - Cause chain navigation");
    console.log("\n🧪 Test scenarios:");
    console.log("  /error-test page has buttons to trigger different error types");
    console.log("  Tests verify source map resolution and overlay behavior");
} catch (error) {
    console.error("❌ Playwright setup failed:", error.message);
    process.exit(1);
}
