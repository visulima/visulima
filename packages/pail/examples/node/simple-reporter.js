import { createPail } from "@visulima/pail";
import { SimpleReporter } from "@visulima/pail/reporter/simple";

console.log("------------------ SIMPLE REPORTER - BASIC USAGE ------------------", "\n");

const logger = createPail({
    reporters: [new SimpleReporter()],
});

logger.info("Simple reporter provides clean, minimal output");
logger.success("Operation completed successfully");
logger.warn("This is a warning message");
logger.error("An error occurred");

console.log("\n", "------------------ SIMPLE REPORTER - WITH SCOPE ------------------", "\n");

const scopedLogger = logger.scope("api", "users");

scopedLogger.info("Fetching user data");
scopedLogger.success("User data retrieved");
scopedLogger.error("Failed to fetch user");

console.log("\n", "------------------ SIMPLE REPORTER - OBJECT INSPECTION ------------------", "\n");

const userData = {
    id: 123,
    name: "John Doe",
    email: "john@example.com",
    preferences: {
        theme: "dark",
        notifications: true,
    },
};

logger.info("User data:", userData);
logger.debug("Debug info:", { timestamp: new Date(), requestId: "req-123" });

console.log("\n", "------------------ SIMPLE REPORTER - ERROR HANDLING ------------------", "\n");

const error = new Error("Database connection failed");
error.cause = new Error("Connection timeout");

logger.error("Database error occurred", error);

logger.error(
    new TypeError("Invalid input type", {
        cause: new Error("Expected string, got number"),
    }),
);

console.log("\n", "------------------ SIMPLE REPORTER - CUSTOM OPTIONS ------------------", "\n");

const customLogger = createPail({
    reporters: [
        new SimpleReporter({
            inspect: {
                depth: 2,
                colors: true,
            },
            error: {
                hideErrorCauseCodeView: false,
            },
        }),
    ],
});

const nestedObject = {
    level1: {
        level2: {
            level3: {
                level4: "deep value",
            },
        },
    },
};

customLogger.info("Nested object (depth limited to 2):", nestedObject);

console.log("\n", "------------------ SIMPLE REPORTER - STRUCTURED MESSAGES ------------------", "\n");

logger.info({
    message: "Processing request",
    prefix: "API",
    suffix: "v1.0",
    context: [
        {
            method: "GET",
            path: "/api/users",
            statusCode: 200,
        },
    ],
});

logger.complete({
    message: "Task finished",
    prefix: "build",
    suffix: "success",
});

console.log("\n", "------------------ SIMPLE REPORTER - GROUPS ------------------", "\n");

const groupLogger = logger.scope("application");

groupLogger.info("Starting application");
groupLogger.group("Database");
groupLogger.info("Connecting to database");
groupLogger.success("Database connected");
groupLogger.group("Cache");
groupLogger.info("Initializing cache");
groupLogger.success("Cache initialized");
groupLogger.groupEnd();
groupLogger.groupEnd();
groupLogger.info("Application started successfully");

console.log("\n", "------------------ SIMPLE REPORTER - TIMERS ------------------", "\n");

logger.time("data-processing");
logger.info("Processing data...");

await new Promise((resolve) => setTimeout(resolve, 500));
logger.timeEnd("data-processing");

console.log("\n", "------------------ SIMPLE REPORTER - COUNTERS ------------------", "\n");

logger.count("requests");
logger.count("requests");
logger.count("requests");
logger.count("errors");
logger.count("errors");
