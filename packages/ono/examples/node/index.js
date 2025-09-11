import { createServer } from "node:http";

import { Ono } from "@visulima/ono";
import createRequestContext from "@visulima/ono/page/context";
import { createNodeHttpHandler } from "@visulima/ono/server/open-in-editor";

// Deeper stack builders (sync + async levels)
function parseEnvironmentConfig() {
    // Deepest sync failure
    throw new Error("Invalid environment configuration: missing 'APP_SECRET'");
}

function initializeModelLayer() {
    try {
        parseEnvironmentConfig();
    } catch (innerError) {
        throw new Error("Model initialization failed", { cause: innerError });
    }
}

async function queryDatabase() {
    // Simulate async boundary
    await Promise.resolve();
    throw new Error("Database connection timeout");
}

/**
 * @param {string} userId
 * @returns {Promise<Record<string, unknown>>}
 */
async function loadUserProfile(userId) {
    try {
        await queryDatabase();
    } catch (innerError) {
        throw new Error(`Failed to load user profile for ${userId}`, { cause: innerError });
    }

    return { id: userId, name: "Test User", preferences: {} };
}

/**
 * @param {Record<string, unknown>} profile
 */
function computeRecommendations(profile) {
    try {
        initializeModelLayer();
    } catch (innerError) {
        throw new Error("Recommendation engine startup failed", { cause: innerError });
    }

    // This line is not reached due to the error above, but keeps another frame
    return [profile];
}

async function renderController() {
    try {
        const profile = await loadUserProfile("user-123");
        computeRecommendations(profile);
    } catch (innerError) {
        throw new Error("Controller render failed", { cause: innerError });
    }
}

const port = 3000;
const openInEditorHandler = createNodeHttpHandler();
const ono = new Ono();

const server = createServer(async (request, response) => {
    const url = new URL(request.url || "/", `http://localhost:${port}`);

    /**
     * @param {unknown} error
     * @param {any[]} solutionFinders
     */
    async function show(error, solutionFinders) {
        const routing = { route: url.pathname, params: {}, query: Object.fromEntries(url.searchParams.entries()) };
        const user = { client: { ip: request.socket?.remoteAddress, userAgent: request.headers["user-agent"] } };
        const git = { branch: process.env.GIT_BRANCH, commit: process.env.GIT_COMMIT, tag: process.env.GIT_TAG, dirty: process.env.GIT_DIRTY === "true" };
        const versions = { node: process.version };

        const contextPage = await createRequestContext(request, {
            context: {
                app: { routing },
                user,
                git,
                versions,
                //         // Add some custom context to demonstrate the new API
                database: {
                    connection: "active",
                    queries: ["SELECT * FROM users", "INSERT INTO logs"],
                    pools: {
                        read: { active: 5, idle: 3, max: 10 },
                        write: { active: 2, idle: 1, max: 5 },
                    },
                    metrics: {
                        queries: { total: 1250, slow: 23, errors: 2 },
                        connections: { current: 8, peak: 12 },
                    },
                },
                cache: {
                    status: "healthy",
                    keys: 1250,
                    memory: "45MB",
                    layers: {
                        l1: { type: "memory", hitRate: 0.95, size: "10MB" },
                        l2: { type: "redis", hitRate: 0.87, size: "100MB" },
                    },
                    patterns: ["user:*", "session:*", "api:*"],
                },
                environment: {
                    NODE_ENV: process.env.NODE_ENV || "development",
                    PORT: process.env.PORT || "3000",
                    features: {
                        auth: true,
                        caching: true,
                        monitoring: false,
                    },
                },
                performance: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    cpu: process.cpuUsage(),
                    versions: {
                        node: process.version,
                        v8: process.versions.v8,
                        openssl: process.versions.openssl,
                    },
                },
            },
            headerAllowlist: ["content-type", "accept", "user-agent"],
        });

        // Generate HTML with new Ono class
        const html = await ono.toHTML(error, {
            content: [contextPage],
            openInEditorUrl: "/__open-in-editor",
            solutionFinders,
            cspNonce: "node-nonce-" + Date.now(),
            theme: "auto",
        });

        response.writeHead(500, {
            "Content-Type": "text/html",
            "Content-Length": Buffer.byteLength(html, "utf8"),
        });
        response.end(html);
    }

    if (url.pathname === "/__open-in-editor") {
        return openInEditorHandler(request, response);
    }

    // Showcase routes for each hint - demonstrating solution finders
    if (url.pathname === "/esm-cjs") {
        try {
            throw new Error("Error [ERR_REQUIRE_ESM]: Must use import to load ES Module");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    if (url.pathname === "/export-mismatch") {
        try {
            throw new Error("Attempted import error: default export not found");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    if (url.pathname === "/enoent") {
        try {
            throw new Error("Cannot find module './Foo' imported from ./bar");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    if (url.pathname === "/ts-paths") {
        try {
            throw new Error("TS2307: Cannot find module '@app/utils'");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    if (url.pathname === "/dns") {
        try {
            throw new Error("getaddrinfo ENOTFOUND api.example.com");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    if (url.pathname === "/hydration") {
        try {
            throw new Error("Hydration failed because the initial UI does not match what was rendered on the server");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    if (url.pathname === "/undefined-prop") {
        try {
            throw new Error("TypeError: Cannot read properties of undefined (reading 'foo')");
        } catch (err) {
            return show(err, []); // Uses built-in rule-based finder
        }
    }

    // New route demonstrating custom solution finder
    if (url.pathname === "/custom-solution") {
        try {
            const error = new Error("Custom application error");
            error.cause = new Error("Something went wrong in the business logic");
            throw error;
        } catch (err) {
            const customFinder = {
                name: "custom-app-finder",
                priority: 100,
                /**
                 * @param {Error} error
                 * @param {any} _context
                 */
                handle: async (error, _context) => {
                    if (error.message.includes("Custom application error")) {
                        return {
                            header: "Custom Solution for App Error",
                            body: "This is a custom solution finder that provides specific guidance for your application's errors. Check the business logic in your service layer.",
                        };
                    }
                    return undefined;
                },
            };
            return show(err, [customFinder]);
        }
    }

    try {
        await renderController();
    } catch (controllerError) {
        /** @type {Error & { hint?: string }} */
        const error = new Error("This is a error message, that is really long error message, This is a error message, that is really long error message", {
            cause: controllerError,
        });
        error.hint = "This is a hint message";

        try {
            await show(error, []); // Uses built-in error hint finder
            return;
        } catch (error_) {
            console.error("Error in Ono class rendering:", error_);

            // Fallback response
            if (!response.headersSent) {
                response.writeHead(500, { "Content-Type": "text/plain" });
                response.end("Internal Server Error: Could not display error details.");
            } else if (!response.writableEnded) {
                response.end();
            }
        }
    }
});

server.listen(port, () => {
    console.log(`Ono (new API) Node.js example running at http://localhost:${port}`);
    console.log("\nTry these routes:");
    console.log("  /esm-cjs          - ESM/CJS interop error");
    console.log("  /export-mismatch  - Export mismatch error");
    console.log("  /enoent           - Missing file error");
    console.log("  /ts-paths         - TypeScript path error");
    console.log("  /dns              - DNS resolution error");
    console.log("  /hydration        - React hydration error");
    console.log("  /undefined-prop   - Property access error");
    console.log("  /custom-solution  - Custom solution finder demo");
    console.log("  /error            - Default error with context");
});
