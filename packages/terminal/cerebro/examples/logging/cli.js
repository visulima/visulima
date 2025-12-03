// Demonstrates the new simplified logger API

import { Cerebro } from "@visulima/cerebro";

const mode = process.env.LOGGER || "console"; // "console", "pail", or "custom"

console.log(`\n🔧 Logger: ${mode}\n`);

let cli;

switch (mode) {
    case "console": {
        console.log("✅ Console logger (default, lightweight)");
        console.log("   - Fast initialization");
        console.log("   - Perfect for most CLIs\n");

        // Option 1: Explicit "console"
        cli = new Cerebro("my-cli", { logger: "console" });

        // Option 2: Omit logger (defaults to console)
        // cli = new Cerebro("my-cli");
        break;
    }

    case "custom": {
        console.log("✅ Custom logger");
        console.log("   - Your own implementation");
        console.log("   - Full control\n");

        // Create custom logger
        const customLogger = {
            alert: (message) => console.log(`[🚨 ALERT] ${message}`),
            critical: (message) => console.log(`[💥 CRITICAL] ${message}`),
            debug: (message) => console.log(`[🐛 DEBUG] ${message}`),
            disable: () => {},
            emergency: (message) => console.log(`[🆘 EMERGENCY] ${message}`),
            enable: () => {},
            error: (message) => console.log(`[❌ ERROR] ${message}`),
            info: (message) => console.log(`[ℹ️  INFO] ${message}`),
            log: (message) => console.log(`[📝 LOG] ${message}`),
            raw: console.log,
            success: (message) => console.log(`[✨ SUCCESS] ${message}`),
            trace: console.trace,
            warn: (message) => console.log(`[⚠️  WARN] ${message}`),
            warning: (message) => console.log(`[⚠️  WARNING] ${message}`),
        };

        cli = new Cerebro("my-cli", { logger: customLogger });
        break;
    }

    case "pail": {
        console.log("✅ Pail logger (lazy-loaded, feature-rich)");
        console.log("   - Pretty output with colors");
        console.log("   - Structured logging");
        console.log("   - Lazy-loaded (no overhead until first log)\n");

        cli = new Cerebro("my-cli", { logger: "pail" });
        break;
    }

    default: {
        console.error(`Unknown logger: ${mode}`);
        process.exit(1);
    }
}

// Add a command that uses logging
cli.addCommand({
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
    name: "test",
});

await cli.run();
