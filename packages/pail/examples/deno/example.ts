#!/usr/bin/env -S deno run --allow-all

/**
 * Pail example for Deno
 * Run with: deno run --allow-all example.ts
 */

import { pail } from "@visulima/pail";

// Basic logging examples
pail.info("🚀 Pail is running in Deno!");
pail.success("Operation successful");
pail.debug("Debug information");
pail.warn("This is a warning");
pail.error("This is an error");

// Custom logger types
const logger = pail.scope("deno-app");

logger.info("Hello from scoped logger");
logger.success("Task completed successfully");

// Timer examples
pail.time("deno-timer");

setTimeout(() => {
    pail.timeEnd("deno-timer");
    pail.info("Timer example completed");
}, 1000);

// Custom types
const customLogger = pail.scope("custom", {
    types: {
        deno: {
            badge: "🦕",
            color: "cyan",
            label: "deno",
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

customLogger.deno("Running in Deno runtime");
customLogger.runtime("Fast and secure JavaScript runtime");

// Interactive logging (only works in TTY environments)
if (Deno.stdout.isTerminal()) {
    const interactive = pail.scope("interactive", { interactive: true });
    interactive.await("Processing in Deno...");

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

pail.complete({
    prefix: "[deno]",
    message: "Pail Deno example completed",
    suffix: "✅",
});
