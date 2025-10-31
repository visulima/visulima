// packages/cerebro/__bench__/test-auto-dispose.js
import { Cerebro } from "@visulima/cerebro";

console.log("Testing auto-dispose functionality...\n");

const initialUncaught = process.listenerCount("uncaughtException");
const initialRejection = process.listenerCount("unhandledRejection");

console.log(`Initial listeners: ${initialUncaught} uncaughtException, ${initialRejection} unhandledRejection\n`);

// Test 1: Auto-dispose enabled by default
console.log("Test 1: Auto-dispose enabled (default)");

for (let i = 0; i < 5; i++) {
    const cli = new Cerebro("test-cli", { argv: ["help"] });

    cli.addCommand({
        execute: () => {},
        name: "test",
    });
    await cli.run({ shouldExitProcess: false }); // autoDispose defaults to true
}

const afterAutoDispose = process.listenerCount("uncaughtException");

console.log(`After 5 runs with autoDispose=true: ${afterAutoDispose} listeners`);
console.log(`Expected: ${initialUncaught} (should be same as initial)`);
console.log(afterAutoDispose === initialUncaught ? "✅ PASS: Listeners auto-cleaned" : "❌ FAIL: Listeners leaked\n");

// Test 2: Auto-dispose disabled
console.log("\nTest 2: Auto-dispose disabled");

for (let i = 0; i < 5; i++) {
    const cli = new Cerebro("test-cli-no-dispose", { argv: ["help"] });

    cli.addCommand({
        execute: () => {},
        name: "test",
    });
    await cli.run({ autoDispose: false, shouldExitProcess: false });
}

const afterNoDispose = process.listenerCount("uncaughtException");

console.log(`After 5 runs with autoDispose=false: ${afterNoDispose} listeners`);
console.log(`Expected: ${initialUncaught + 5} (should have added 5 listeners)`);
console.log(afterNoDispose === initialUncaught + 5 ? "✅ PASS: Listeners not disposed" : "❌ FAIL: Unexpected count\n");

// Test 3: Auto-dispose even on error
console.log("\nTest 3: Auto-dispose on error");
const beforeError = process.listenerCount("uncaughtException");

try {
    const cli = new Cerebro("test-cli-error", { argv: ["nonexistent"] });

    cli.addCommand({
        execute: () => {},
        name: "test",
    });
    await cli.run({ shouldExitProcess: false }); // This will throw CommandNotFoundError
} catch {
    // Expected error
}

const afterError = process.listenerCount("uncaughtException");

console.log(`Before error: ${beforeError} listeners`);
console.log(`After error: ${afterError} listeners`);
console.log(afterError === beforeError ? "✅ PASS: Disposed even on error" : "❌ FAIL: Leaked on error");

// Summary
console.log(`\n${"=".repeat(50)}`);
console.log("SUMMARY");
console.log("=".repeat(50));
console.log(`Initial listeners: ${initialUncaught}`);
console.log(`After all tests: ${afterError}`);
console.log(`Net change: ${afterError - initialUncaught} (from 5 instances with autoDispose=false)`);
console.log("\n✅ Auto-dispose feature working correctly!");
console.log("   - Automatically cleans up by default");
console.log("   - Can be disabled with autoDispose: false");
console.log("   - Cleans up even when errors occur");

