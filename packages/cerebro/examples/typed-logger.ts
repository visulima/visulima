// TypeScript example demonstrating typed logger support

import type { Pail } from "@visulima/pail";

import { Cerebro } from "../src";

// Example 1: Default logger (Pail type)
const cli1 = new Cerebro("typed-cli-1");
// logger type is: Pail

cli1.addCommand({
    name: "test1",
    execute: ({ logger }) => {
        // ✅ TypeScript knows logger is Pail
        logger.info("Default logger");
        logger.success("All methods available");
    },
});

// Example 2: Explicitly typed as Pail
const cli2 = new Cerebro<Pail>("typed-cli-2", { logger: "pail" });
// logger type is: Pail

cli2.addCommand({
    name: "test2",
    execute: ({ logger }) => {
        // ✅ TypeScript knows logger is Pail
        logger.debug("Pail logger");
    },
});

// Example 3: Custom logger with extended interface
interface MyCustomLogger extends Pail {
    customMethod: (message: string) => void;
    metadata: Record<string, unknown>;
}

const myLogger: MyCustomLogger = {
    // Pail interface methods
    alert: (msg: string) => console.log(`[ALERT] ${msg}`),
    critical: (msg: string) => console.log(`[CRITICAL] ${msg}`),
    debug: (msg: string) => console.log(`[DEBUG] ${msg}`),
    disable: () => {},
    emergency: (msg: string) => console.log(`[EMERGENCY] ${msg}`),
    enable: () => {},
    error: (msg: string) => console.log(`[ERROR] ${msg}`),
    info: (msg: string) => console.log(`[INFO] ${msg}`),
    log: (msg: string) => console.log(`[LOG] ${msg}`),
    raw: (msg: string) => console.log(msg),
    success: (msg: string) => console.log(`[SUCCESS] ${msg}`),
    trace: (...args: unknown[]) => console.trace(...args),
    warn: (msg: string) => console.log(`[WARN] ${msg}`),
    warning: (msg: string) => console.log(`[WARNING] ${msg}`),

    // Custom methods
    customMethod: (message: string) => {
        console.log(`[CUSTOM] ${message}`);
    },
    metadata: {
        version: "1.0.0",
        environment: "production",
    },
};

// ✨ Generic type parameter gives us proper typing!
const cli3 = new Cerebro<MyCustomLogger>("typed-cli-3", { logger: myLogger });
// logger type is: MyCustomLogger

cli3.addCommand({
    name: "test3",
    execute: ({ logger }) => {
        // ✅ TypeScript knows about all Pail methods
        logger.info("Custom logger");

        // ✅ TypeScript knows about custom methods!
        logger.customMethod("This is a custom log method");

        // ✅ TypeScript knows about custom properties!
        console.log("Logger metadata:", logger.metadata);

        // ❌ TypeScript error if you try to call non-existent method
        // logger.nonExistentMethod(); // Error!
    },
});

// Example 4: Using createCerebro helper with types
import { createCerebro } from "../src";

const cli4 = createCerebro<MyCustomLogger>("typed-cli-4", { logger: myLogger });
// Same type safety as new Cerebro<MyCustomLogger>(...)

cli4.addCommand({
    name: "test4",
    execute: ({ logger }) => {
        // ✅ Full type safety with createCerebro too!
        logger.customMethod("Type-safe helper function");
    },
});

// Example 5: Getting logger from CLI instance
const cli5 = new Cerebro<MyCustomLogger>("typed-cli-5", { logger: myLogger });

// ✅ getLogger() returns the correctly typed logger
const typedLogger = cli5.getLogger();
typedLogger.customMethod("Direct logger access");
console.log(typedLogger.metadata);

console.log(`
✅ TypeScript Type Safety Examples

All examples above have full type safety:
- Default logger: Pail type
- Pail logger: Pail type
- Custom logger: Your extended type

Benefits:
- Autocomplete for logger methods
- Compile-time error checking
- Type inference in commands
- Support for custom logger properties
`);
