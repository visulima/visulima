// Demonstrates the three ways to use loggers in Cerebro

import { Cerebro } from "@visulima/cerebro";
import { consoleLoggerPlugin } from "@visulima/cerebro/plugins/console-logger";
import { pailLoggerPlugin } from "@visulima/cerebro/plugins/pail-logger";

const mode = process.env.LOGGER_MODE || "default"; // "default", "inject", "plugin-console", "plugin-pail"

console.log(`\n🔧 Logger Mode: ${mode}\n`);

let cli;

switch (mode) {
    case "default":
        console.log("✅ Using DEFAULT logger (built-in, no setup needed)");
        console.log("   - Simple console-based logger");
        console.log("   - Zero configuration");
        console.log("   - Perfect for quick CLIs\n");

        // No logger setup needed - uses built-in default
        cli = new Cerebro("logger-demo");
        break;

    case "inject":
        console.log("✅ Using INJECTED custom logger (via constructor)");
        console.log("   - Pass your own logger implementation");
        console.log("   - No plugins needed");
        console.log("   - Full control over logging\n");

        // Create a custom logger
        const customLogger = {
            debug: (msg) => console.log(`[🐛 DEBUG] ${msg}`),
            info: (msg) => console.log(`[ℹ️  INFO] ${msg}`),
            log: (msg) => console.log(`[📝 LOG] ${msg}`),
            warn: (msg) => console.log(`[⚠️  WARN] ${msg}`),
            error: (msg) => console.log(`[❌ ERROR] ${msg}`),
            success: (msg) => console.log(`[✨ SUCCESS] ${msg}`),
            // ... other Pail methods
            alert: (msg) => console.log(`[🚨 ALERT] ${msg}`),
            critical: (msg) => console.log(`[💥 CRITICAL] ${msg}`),
            emergency: (msg) => console.log(`[🆘 EMERGENCY] ${msg}`),
            trace: console.trace,
            warning: (msg) => console.log(`[⚠️  WARNING] ${msg}`),
            raw: console.log,
            disable: () => {},
            enable: () => {},
        };

        // Inject the custom logger
        cli = new Cerebro("logger-demo", { logger: customLogger });
        break;

    case "plugin-console":
        console.log("✅ Using CONSOLE LOGGER plugin");
        console.log("   - Lightweight and fast");
        console.log("   - ~0.01ms initialization");
        console.log("   - Best for performance-critical CLIs\n");

        cli = new Cerebro("logger-demo");
        cli.addPlugin(
            consoleLoggerPlugin({
                showSuccessIcon: true,
            }),
        );
        break;

    case "plugin-pail":
        console.log("✅ Using PAIL LOGGER plugin");
        console.log("   - Full-featured logging");
        console.log("   - Pretty output with colors");
        console.log("   - Structured logging, caller tracking\n");

        cli = new Cerebro("logger-demo");
        cli.addPlugin(pailLoggerPlugin());
        break;

    default:
        console.error(`Unknown mode: ${mode}`);
        process.exit(1);
}

// Add a test command that uses logging
cli.addCommand({
    name: "test",
    description: "Test various log levels",
    execute: ({ logger }) => {
        console.log("\n📊 Testing log levels:\n");

        logger.debug("This is a debug message");
        logger.info("This is an info message");
        logger.log("This is a log message");
        logger.warn("This is a warning");
        logger.error("This is an error");
        logger.success("This is a success message");

        console.log("\n✅ All log levels tested!\n");
    },
});

await cli.run();
