#!/usr/bin/env bun

import { Ono } from "../../dist/index.js";
import createRequestContextPage from "../../dist/error-inspector/page/create-request-context.js";

const ono = new Ono();

// Deep stack trace example for Bun
function parseBunConfig() {
    // Simulate a configuration parsing error
    throw new Error("Invalid Bun configuration: missing 'BUN_ENV' environment variable");
}

function initializeBunService() {
    try {
        parseBunConfig();
    } catch (innerError) {
        throw new Error("Bun service initialization failed", { cause: innerError });
    }
}

async function fetchBunData() {
    // Simulate async operation with Bun's fetch (which is faster than Node's)
    await Bun.sleep(10); // Bun has a built-in sleep function!
    throw new Error("Failed to fetch data from Bun SQLite");
}

async function processBunRequest() {
    try {
        await fetchBunData();
    } catch (innerError) {
        throw new Error("Bun request processing failed", { cause: innerError });
    }
}

const port = 3001;

console.log("🚀 Bun + Ono Example Server");
console.log(`📡 Server running at http://localhost:${port}`);
console.log("⚡ Hot reload enabled - try editing this file!");
console.log("\nTry these routes:");
console.log("  /                 - Home page with Bun info");
console.log("  /error            - Basic error with Bun context");
console.log("  /bun-specific     - Bun-specific features");
console.log("  /performance      - Performance comparison");
console.log("  /sqlite           - SQLite integration example");

const server = Bun.serve({
    port,
    async fetch(request: Request) {
        const url = new URL(request.url);

        // Helper function to create error responses
        async function createErrorResponse(error: unknown, solutionFinders: any[] = []) {
            try {
                // Create Bun-specific context
                const bunContext = {
                    runtime: {
                        name: "Bun",
                        version: Bun.version,
                        platform: process.platform,
                        arch: process.arch,
                    },
                    environment: {
                        bunEnv: process.env.BUN_ENV || "development",
                        nodeEnv: process.env.NODE_ENV || "development",
                        cwd: process.cwd(),
                    },
                    performance: {
                        startupTime: performance.now(), // High-precision timing
                        memoryUsage: process.memoryUsage(),
                        uptime: process.uptime(),
                        pid: process.pid,
                    },
                    bunFeatures: {
                        hotReload: true, // This server supports hot reload
                        fastStartup: true,
                        nativeSQLite: true,
                        webAPIs: true,
                    },
                    request: {
                        method: request.method,
                        url: request.url,
                        headers: Object.fromEntries(request.headers.entries()),
                        userAgent: request.headers.get("user-agent"),
                    },
                };

                // Create request context page (adapted for Bun Request)
                const mockNodeRequest = {
                    method: request.method,
                    url: request.url,
                    headers: Object.fromEntries(request.headers.entries()),
                };

                const contextPage = await createRequestContextPage(mockNodeRequest as any, {
                    context: bunContext,
                    headerAllowlist: ["content-type", "accept", "user-agent", "x-forwarded-for"],
                });

                return new Response(
                    await ono.toHTML(error as Error, {
                        content: [contextPage],
                        solutionFinders,
                        cspNonce: `bun-nonce-${Date.now()}`,
                        theme: "auto",
                    }),
                    {
                        status: 500,
                        headers: {
                            "Content-Type": "text/html",
                            "X-Bun-Version": Bun.version,
                            "X-Server": "Bun",
                        },
                    }
                );
            } catch (renderError) {
                console.error("Failed to render error page:", renderError);
                return new Response("Internal Server Error: Could not render error page", {
                    status: 500,
                    headers: { "Content-Type": "text/plain" },
                });
            }
        }

        // Route handlers
        if (url.pathname === "/") {
            const startupTime = performance.now();
            return new Response(`
                <!DOCTYPE html>
                <html>
                    <head>
                        <title>Bun + Ono Example</title>
                        <style>
                            body { font-family: system-ui, sans-serif; padding: 2rem; }
                            .route { margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ccc; }
                            .method { font-weight: bold; color: #059669; }
                            .bun-info { background: #ecfdf5; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; }
                        </style>
                    </head>
                    <body>
                        <h1>Bun + Ono Example Server</h1>
                        <div class="bun-info">
                            <h3>Bun Runtime Information</h3>
                            <p><strong>Version:</strong> ${Bun.version}</p>
                            <p><strong>Platform:</strong> ${process.platform}</p>
                            <p><strong>Architecture:</strong> ${process.arch}</p>
                            <p><strong>Startup Time:</strong> ${startupTime.toFixed(2)}ms</p>
                            <p><strong>Hot Reload:</strong> Enabled</p>
                        </div>
                        <p>Click on these routes to see different error scenarios:</p>
                        <div class="route">
                            <a href="/error"><span class="method">GET</span> /error</a> - Basic error with Bun context
                        </div>
                        <div class="route">
                            <a href="/bun-specific"><span class="method">GET</span> /bun-specific</a> - Bun-specific error
                        </div>
                        <div class="route">
                            <a href="/performance"><span class="method">GET</span> /performance</a> - Performance metrics
                        </div>
                        <div class="route">
                            <a href="/sqlite"><span class="method">GET</span> /sqlite</a> - SQLite integration
                        </div>
                    </body>
                </html>
            `, {
                headers: { "Content-Type": "text/html" },
            });
        }

        if (url.pathname === "/error") {
            try {
                await processBunRequest();
            } catch (error) {
                return await createErrorResponse(error);
            }
        }

        if (url.pathname === "/bun-specific") {
            try {
                initializeBunService();
            } catch (error) {
                // Add Bun-specific solution finder
                const bunSolutionFinder = {
                    name: "bun-config-finder",
                    priority: 100,
                    handle: async (err: Error) => {
                        if (err.message.includes("BUN_ENV")) {
                            return {
                                header: "Bun Environment Configuration",
                                body: "Make sure to set the BUN_ENV environment variable. You can set it to 'development', 'production', or 'test'.",
                            };
                        }
                        if (err.message.includes("bunfig.toml")) {
                            return {
                                header: "Bun Configuration File",
                                body: "Check your bunfig.toml file for correct configuration. Bun uses TOML format for configuration.",
                            };
                        }
                        return undefined;
                    },
                };
                return await createErrorResponse(error, [bunSolutionFinder]);
            }
        }

        if (url.pathname === "/performance") {
            try {
                // Simulate a performance-critical operation
                const startTime = performance.now();

                // Do some work
                await Bun.sleep(1); // Microsecond precision sleep
                const work = Array.from({ length: 1000 }, (_, i) => i * i);

                const endTime = performance.now();
                const duration = endTime - startTime;

                throw new Error(`Performance test completed in ${duration.toFixed(3)}ms with ${work.length} operations`);
            } catch (error) {
                return await createErrorResponse(error);
            }
        }

        if (url.pathname === "/sqlite") {
            try {
                // Demonstrate Bun's built-in SQLite support
                const db = new Bun.sqlite(":memory:");

                // Create a test table
                db.run("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT, value REAL)");

                // Insert some data
                const insert = db.prepare("INSERT INTO test (name, value) VALUES (?, ?)");
                insert.run("Bun", 1.0);
                insert.run("Ono", 2.0);

                // Query the data
                const query = db.prepare("SELECT * FROM test");
                const results = query.all();

                // Close the database
                db.close();

                throw new Error(`SQLite test successful: ${results.length} rows inserted and retrieved`);
            } catch (error) {
                return await createErrorResponse(error);
            }
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`\n🎯 Server started successfully!`);
console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
console.log(`⚡ Ready for hot reload - edit this file and see changes instantly!`);

// Graceful shutdown handling
process.on("SIGINT", () => {
    console.log("\n👋 Shutting down Bun server gracefully...");
    server.stop();
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("\n👋 Received SIGTERM, shutting down...");
    server.stop();
    process.exit(0);
});
