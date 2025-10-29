// Demonstrates the new simplified logger API

import { Cerebro } from "@visulima/cerebro";

const mode = process.env.LOGGER || "console"; // "console", "pail", or "custom"

console.log(`\n🔧 Logger: ${mode}\n`);

let cli;

switch (mode) {
    case "console":
        console.log("✅ Console logger (default, lightweight)");
        console.log("   - Fast initialization");
        console.log("   - Perfect for most CLIs\n");

        // Option 1: Explicit "console"
        cli = new Cerebro("my-cli", { logger: "console" });

        // Option 2: Omit logger (defaults to console)
        // cli = new Cerebro("my-cli");
        break;

    case "pail":
        console.log("✅ Pail logger (lazy-loaded, feature-rich)");
        console.log("   - Pretty output with colors");
        console.log("   - Structured logging");
        console.log("   - Lazy-loaded (no overhead until first log)\n");

        cli = new Cerebro("my-cli", { logger: "pail" });
        break;

    case "custom":
        console.log("✅ Custom logger");
        console.log("   - Your own implementation");
        console.log("   - Full control\n");

        // Create custom logger
        const customLogger = {
            debug: (msg) => console.log(`[🐛 DEBUG] ${msg}`),
            info: (msg) => console.log(`[ℹ️  INFO] ${msg}`),
            log: (msg) => console.log(`[📝 LOG] ${msg}`),
            warn: (msg) => console.log(`[⚠️  WARN] ${msg}`),
            error: (msg) => console.log(`[❌ ERROR] ${msg}`),
            success: (msg) => console.log(`[✨ SUCCESS] ${msg}`),
            alert: (msg) => console.log(`[🚨 ALERT] ${msg}`),
            critical: (msg) => console.log(`[💥 CRITICAL] ${msg}`),
            emergency: (msg) => console.log(`[🆘 EMERGENCY] ${msg}`),
            trace: console.trace,
            warning: (msg) => console.log(`[⚠️  WARNING] ${msg}`),
            raw: console.log,
            disable: () => {},
            enable: () => {},
        };

        cli = new Cerebro("my-cli", { logger: customLogger });
        break;

    default:
        console.error(`Unknown logger: ${mode}`);
        process.exit(1);
}

// Add a command that uses logging
cli.addCommand({
    name: "test",
    description: "Test logging",
    execute: ({ logger }) => {
        console.log("\n📊 Testing log levels:\n");

        logger.debug("This is a debug message");
        logger.info("This is an info message");
        logger.log("This is a log message");
        logger.warn("This is a warning");
        logger.error("This is an error");

        console.log("\n✅ All log levels tested!\n");
    },
});

await cli.run();
