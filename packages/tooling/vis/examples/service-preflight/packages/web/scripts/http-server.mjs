#!/usr/bin/env node
import { createServer } from "node:http";

const port = Number.parseInt(process.env["PORT"] ?? process.argv[2] ?? "3000", 10);
const label = "web";

if (!Number.isFinite(port) || port <= 0) {
    console.error(`[${label}] invalid port`);
    process.exit(1);
}

const server = createServer((req, res) => {
    const stamp = new Date().toISOString();

    console.log(`[${label}] ${stamp} ${req.method} ${req.url}`);

    if (req.url === "/slow") {
        let i = 0;

        const tick = setInterval(() => {
            i += 1;
            const line = `[${label}] streaming chunk ${i}/5\n`;

            console.log(line.trimEnd());
            res.write(line);

            if (i >= 5) {
                clearInterval(tick);
                res.end("done\n");
            }
        }, 400);

        return;
    }

    res.writeHead(200, { "content-type": "text/plain" });
    res.end(`web hello\n  DB=${process.env["DATABASE_URL"] ?? "unset"}\n  REDIS=${process.env["REDIS_URL"] ?? "unset"}\n  path=${req.url}\n`);
});

server.on("error", (error) => {
    console.error(`[${label}] server error:`, error.message);
    process.exit(1);
});

server.listen(port, "127.0.0.1", () => {
    console.log(`[${label}] listening on 127.0.0.1:${port}`);
    console.log(`[${label}] try: curl http://127.0.0.1:${port}/`);
    console.log(`[${label}] try: curl http://127.0.0.1:${port}/slow  (streams 5 chunks)`);
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
}, 3000).unref();
