#!/usr/bin/env node
import { createServer } from "node:net";

const port = Number.parseInt(process.argv[2] ?? "0", 10);
const label = process.argv[3] ?? "tcp-server";
// Default to a visible boot delay so the preflight TUI has time to render
// log lines and spinners. Override with `BOOT_DELAY_MS=0` for snappy boots.
const bootDelayMs = Number.parseInt(process.env["BOOT_DELAY_MS"] ?? "1500", 10);

if (!Number.isFinite(port) || port <= 0) {
    console.error(`[${label}] missing or invalid port arg`);
    process.exit(1);
}

const start = () => {
    const server = createServer((socket) => {
        socket.write(`hello from ${label}\n`);
        socket.end();
    });

    server.on("error", (error) => {
        console.error(`[${label}] server error:`, error.message);
        process.exit(1);
    });

    server.listen(port, "127.0.0.1", () => {
        console.log(`[${label}] listening on 127.0.0.1:${port}`);
    });

    const shutdown = (signal) => {
        console.log(`[${label}] received ${signal}, shutting down`);
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 1000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    setInterval(() => {
        console.log(`[${label}] heartbeat ${new Date().toISOString()}`);
    }, 5000).unref();
};

if (bootDelayMs > 0) {
    console.log(`[${label}] simulated boot — running migrations…`);
    setTimeout(() => {
        console.log(`[${label}] migrations done, opening port ${port}`);
        start();
    }, bootDelayMs);
} else {
    start();
}
