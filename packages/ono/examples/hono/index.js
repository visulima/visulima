import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Ono } from "@visulima/ono";

const app = new Hono();
const ono = new Ono();

/**
 * Generate a cryptographically strong random CSP nonce
 * @returns {string} Base64 URL-safe encoded nonce
 */
const generateCspNonce = () => {
    // Generate 16 random bytes and encode as base64 URL-safe
    const bytes = randomBytes(16);
    return bytes.toString("base64url");
};

app.get("/", (c) => c.text("OK"));

app.get("/error", () => {
    throw new Error("Boom from Hono");
});

app.get("/error-html", async (c) => {
    // Construct error using the Error constructor's cause option
    const error = new Error("Complex error with context", {
        cause: new Error("Database connection failed"),
    });

    // Generate HTML error page with cryptographically strong random nonce
    const html = await ono.toHTML(error, {
        cspNonce: generateCspNonce(),
        theme: "light",
    });

    return c.html(html);
});

app.get("/api/error-json", async (c) => {
    const error = new Error("API Error");
    /** @type {{ errorAnsi: string; solutionBox: string | undefined }} */
    const ansiResult = await ono.toANSI(error, {
        solutionFinders: [
            {
                name: "api-finder",
                priority: 100,
                /** @param {Error} err */
                /** @param {any} context */
                handle: async (err, context) => {
                    if (err.message.includes("API")) {
                        return {
                            header: "API Error Solution",
                            body: "Check your API endpoint and authentication.",
                        };
                    }
                    return undefined;
                },
            },
        ],
    });

    return c.json({
        error: ansiResult.errorAnsi,
        solution: ansiResult.solutionBox,
        timestamp: new Date().toISOString(),
    });
});

// Handle errors via new Ono class
app.onError(async (err, c) => {
    try {
        // Generate HTML error page with cryptographically strong random nonce
        const html = await ono.toHTML(err, {
            cspNonce: generateCspNonce(),
            theme: "dark",
        });

        return c.html(html, 500);
    } catch (renderError) {
        // Fallback error response
        return c.text("Internal Server Error: Could not render error page", 500);
    }
});

// Make server port configurable with environment variable
const PORT = parseInt(process.env.PORT, 10) || 3000;

serve({
    fetch: app.fetch,
    port: PORT,
});
console.log(`Hono + Ono (new API) running at http://localhost:${PORT}`);
console.log("Try:");
console.log(`  http://localhost:${PORT}/error`);
console.log(`  http://localhost:${PORT}/error-html`);
console.log(`  http://localhost:${PORT}/api/error-json`);
