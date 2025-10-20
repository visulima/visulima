#!/usr/bin/env bun

/**
 * Pail example for Bun
 * Run with: bun run example.ts
 * Or directly: bun example.ts
 */

import { pail } from "@visulima/pail";

// Basic logging examples
pail.info("🚀 Pail is running in Bun!");
pail.success("Operation successful");
pail.debug("Debug information");
pail.warn("This is a warning");
pail.error("This is an error");

// Custom logger types
const logger = pail.scope("bun-app");

logger.info("Hello from scoped logger");
logger.success("Task completed successfully");

// Timer examples
pail.time("bun-timer");

setTimeout(() => {
    pail.timeEnd("bun-timer");
    pail.info("Timer example completed");
}, 1000);

// Custom types
const customLogger = pail.scope("custom", {
    types: {
        bun: {
            badge: "🐰",
            color: "magenta",
            label: "bun",
            logLevel: "info",
        },
        runtime: {
            badge: "⚡",
            color: "yellow",
            label: "runtime",
            logLevel: "debug",
        },
    },
});

customLogger.bun("Running in Bun runtime");
customLogger.runtime("Fast JavaScript runtime with Web APIs");

// Interactive logging (only works in TTY environments)
if (process.stdout.isTTY) {
    const interactive = pail.scope("interactive", { interactive: true });
    interactive.await("Processing in Bun...");

    setTimeout(() => {
        interactive.success("Processing completed!");
    }, 1500);
} else {
    pail.info("Non-interactive environment detected, skipping interactive demo");
}

// Error handling
try {
    throw new Error("Test error for demonstration");
} catch (error) {
    pail.fatal(error);
}

// Bun-specific features
pail.info(`Bun version: ${Bun.version}`);
pail.info(`Node.js compatibility: ${typeof process !== "undefined" ? "✅" : "❌"}`);
pail.info(`Web APIs available: ${typeof fetch !== "undefined" ? "✅" : "❌"}`);

pail.complete({
    prefix: "[bun]",
    message: "Pail Bun example completed",
    suffix: "✅",
});
