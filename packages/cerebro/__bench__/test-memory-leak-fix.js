// packages/cerebro/__bench__/test-memory-leak-fix.js
import { Cerebro } from "@visulima/cerebro";

console.log("Testing memory leak fix...\n");

// Get initial listener count
const initialUncaughtCount = process.listenerCount("uncaughtException");
const initialRejectionCount = process.listenerCount("unhandledRejection");

console.log(`Initial listeners:`);
console.log(`  uncaughtException: ${initialUncaughtCount}`);
console.log(`  unhandledRejection: ${initialRejectionCount}\n`);

// Create 20 CLI instances WITHOUT disposing
console.log("Creating 20 CLI instances WITHOUT dispose()...");

for (let i = 0; i < 20; i++) {
    const cli = new Cerebro(`test-cli-${i}`);
}

const withoutDisposeUncaught = process.listenerCount("uncaughtException");
const withoutDisposeRejection = process.listenerCount("unhandledRejection");

console.log(`After 20 instances WITHOUT dispose():`);
console.log(`  uncaughtException: ${withoutDisposeUncaught} (added ${withoutDisposeUncaught - initialUncaughtCount})`);
console.log(`  unhandledRejection: ${withoutDisposeRejection} (added ${withoutDisposeRejection - initialRejectionCount})\n`);

// Create 20 CLI instances WITH disposing
console.log("Creating 20 CLI instances WITH dispose()...");
const instances = [];

for (let i = 0; i < 20; i++) {
    const cli = new Cerebro(`test-cli-disposed-${i}`);

    instances.push(cli);
}

const beforeDisposeUncaught = process.listenerCount("uncaughtException");
const beforeDisposeRejection = process.listenerCount("unhandledRejection");

console.log(`Before calling dispose() (40 total instances created):`);
console.log(`  uncaughtException: ${beforeDisposeUncaught}`);
console.log(`  unhandledRejection: ${beforeDisposeRejection}\n`);

// Dispose all instances
console.log("Calling dispose() on the last 20 instances...");

for (const cli of instances) {
    cli.dispose();
}

const withDisposeUncaught = process.listenerCount("uncaughtException");
const withDisposeRejection = process.listenerCount("unhandledRejection");

console.log(`After calling dispose() on 20 instances:`);
console.log(`  uncaughtException: ${withDisposeUncaught} (removed ${beforeDisposeUncaught - withDisposeUncaught} listeners)`);
console.log(`  unhandledRejection: ${withDisposeRejection} (removed ${beforeDisposeRejection - withDisposeRejection} listeners)\n`);

// Verify the fix - should have removed 20 listeners
const listenersRemoved = beforeDisposeUncaught - withDisposeUncaught === 20 && beforeDisposeRejection - withDisposeRejection === 20;

if (listenersRemoved) {
    console.log("✅ SUCCESS: Memory leak is FIXED!");
    console.log(`   dispose() successfully removed 20 listeners`);
    console.log(`   Remaining listeners are from the first 20 undisposed instances`);
} else {
    console.log("❌ FAILED: dispose() did not remove listeners");
    console.log(`   Expected to remove 20 listeners, removed ${beforeDisposeUncaught - withDisposeUncaught}/${beforeDisposeRejection - withDisposeRejection}`);
    process.exit(1);
}
