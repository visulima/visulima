import { createServer } from "node:http";

import httpDisplayer from "../../dist/displayer/http-displayer.mjs";
import buildContextPage from "../../dist/error-inspector/content/context.mjs";

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
const server = createServer(async (request, response) => {
    const startTime = Date.now();

    /**
     * @param {string | undefined} cookieHeader
     */
    function parseCookies(cookieHeader) {
        if (!cookieHeader || typeof cookieHeader !== "string") return {};
        /** @type {Record<string, string>} */
        const out = {};
        try {
            cookieHeader.split(";").forEach((pair) => {
                const idx = pair.indexOf("=");
                if (idx === -1) return;
                const name = pair.slice(0, idx).trim();
                const value = pair.slice(idx + 1).trim();
                if (name) out[name] = value;
            });
        } catch {}
        return out;
    }

    /**
     * @param {import('http').IncomingMessage} req
     */
    async function readBody(req) {
        return await new Promise((resolve) => {
            try {
                let data = "";
                req.on("data", (chunk) => {
                    try {
                        data += chunk;
                    } catch (_) {}
                });
                req.on("end", () => resolve(data || undefined));
                req.on("error", () => resolve(undefined));
            } catch {
                resolve(undefined);
            }
        });
    }

    const rawBody = await readBody(request);

    function buildRequestContext() {
        const headers = Object.fromEntries(Object.entries(request.headers).map(([k, v]) => [k, Array.isArray(v) ? v : (v ?? "")]));
        const cookieHeader = Array.isArray(headers["cookie"]) ? headers["cookie"][0] : headers["cookie"];
        const cookies = parseCookies(cookieHeader);
        return {
            method: request.method,
            url: request.url,
            status: 500,
            timings: { start: startTime, end: Date.now(), elapsedMs: Date.now() - startTime },
            headers,
            cookies,
            body: rawBody,
            // session/body are example-only; wire your framework's values if available
            session: { demo: true },
        };
    }

    /** @param {unknown} error */
    async function show(error) {
        const ctx = buildRequestContext();
        const routing = { route: url.pathname, params: {}, query: Object.fromEntries(url.searchParams.entries()) };
        const user = { client: { ip: request.socket?.remoteAddress, userAgent: request.headers["user-agent"] } };
        const git = { branch: process.env.GIT_BRANCH, commit: process.env.GIT_COMMIT, tag: process.env.GIT_TAG, dirty: process.env.GIT_DIRTY === "true" };
        const versions = { node: process.version };

        const contextPage = await buildContextPage(ctx, {
            context: {
                request: ctx,
                app: { routing },
                user,
                git,
                versions,
                // Add some custom context to demonstrate the new API
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
            requestPanel: { headerAllowlist: ["content-type", "accept", "user-agent"] },
        });

        const displayer = await httpDisplayer(/** @type {Error} */ (error), [], {
            content: contextPage ? [contextPage] : [],
        });
        return displayer(request, response);
    }
    const url = new URL(request.url || "/", `http://localhost:${port}`);

    // Showcase routes for each hint
    if (url.pathname === "/esm-cjs") {
        try {
            throw new Error("Error [ERR_REQUIRE_ESM]: Must use import to load ES Module");
        } catch (err) {
            return show(err);
        }
    }

    if (url.pathname === "/export-mismatch") {
        try {
            throw new Error("Attempted import error: default export not found");
        } catch (err) {
            return show(err);
        }
    }

    if (url.pathname === "/enoent") {
        try {
            throw new Error("Cannot find module './Foo' imported from ./bar");
        } catch (err) {
            return show(err);
        }
    }

    if (url.pathname === "/ts-paths") {
        try {
            throw new Error("TS2307: Cannot find module '@app/utils'");
        } catch (err) {
            return show(err);
        }
    }

    if (url.pathname === "/dns") {
        try {
            throw new Error("getaddrinfo ENOTFOUND api.example.com");
        } catch (err) {
            return show(err);
        }
    }

    if (url.pathname === "/hydration") {
        try {
            throw new Error("Hydration failed because the initial UI does not match what was rendered on the server");
        } catch (err) {
            return show(err);
        }
    }

    if (url.pathname === "/undefined-prop") {
        try {
            throw new Error("TypeError: Cannot read properties of undefined (reading 'foo')");
        } catch (err) {
            return show(err);
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
            await show(error);
            return;
        } catch (error_) {
            console.error("Error in flame's httpDisplayer or its handler:", error_);
        }
    }

    // Attempt to send a fallback response
    if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("Internal Server Error: Could not display error details.");
    } else if (!response.writableEnded) {
        response.end();
    }
});

server.listen(port, () => {
    console.log(`Running at http://localhost:${port}`);
});
