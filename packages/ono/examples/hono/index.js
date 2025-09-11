import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Ono } from "@visulima/ono";

const app = new Hono();
const ono = new Ono();

app.get("/", (c) => c.text("OK"));

app.get("/error", () => {
    throw new Error("Boom from Hono");
});

app.get("/error-html", async (c) => {
    const error = new Error("Complex error with context");
    error.cause = new Error("Database connection failed");

    // Generate HTML error page
    const html = await ono.toHTML(error, {
        cspNonce: "hono-nonce-123",
        theme: "light"
    });

    return c.html(html);
});

app.get("/api/error-json", async (c) => {
    const error = new Error("API Error");
    /** @type {{ errorAnsi: string; solutionBox: string | undefined }} */
    const ansiResult = await ono.toANSI(error, {
        solutionFinders: [{
            name: "api-finder",
            priority: 100,
            /** @param {Error} err */
            /** @param {any} context */
            handle: async (err, context) => {
                if (err.message.includes("API")) {
                    return {
                        header: "API Error Solution",
                        body: "Check your API endpoint and authentication."
                    };
                }
                return undefined;
            }
        }]
    });

    return c.json({
        error: ansiResult.errorAnsi,
        solution: ansiResult.solutionBox,
        timestamp: new Date().toISOString()
    });
});

// Handle errors via new Ono class
app.onError(async (err, c) => {
    try {
        // Generate HTML error page
        const html = await ono.toHTML(err, {
            cspNonce: "error-nonce-" + Date.now(),
            theme: "dark"
        });

        return c.html(html, 500);
    } catch (renderError) {
        // Fallback error response
        return c.text("Internal Server Error: Could not render error page", 500);
    }
});

serve({
    fetch: app.fetch,
    port: 3000,
});
console.log("Hono + Ono (new API) running at http://localhost:3000");
console.log("Try:");
console.log("  http://localhost:3000/error");
console.log("  http://localhost:3000/error-html");
console.log("  http://localhost:3000/api/error-json");
