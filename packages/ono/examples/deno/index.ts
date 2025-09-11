#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { Ono } from "@visulima/ono";
import { createRequestContextPage } from "@visulima/ono/page/context";

const ono = new Ono();

// Deep stack trace example for Deno
function parseDenoConfig() {
    // Simulate a configuration parsing error
    throw new Error("Invalid Deno configuration: missing 'DENO_DEPLOYMENT_ID' environment variable");
}

function initializeDenoService() {
    try {
        parseDenoConfig();
    } catch (innerError) {
        throw new Error("Deno service initialization failed", { cause: innerError });
    }
}

async function fetchDenoData() {
    // Simulate async operation with Deno's fetch
    await new Promise((resolve) => setTimeout(resolve, 10));
    throw new Error("Failed to fetch data from Deno KV");
}

async function processDenoRequest() {
    try {
        await fetchDenoData();
    } catch (innerError) {
        throw new Error("Deno request processing failed", { cause: innerError });
    }
}

const port = 8000;

console.log("🚀 Deno + Ono Example Server");
console.log(`📡 Server running at http://localhost:${port}`);
console.log("\nTry these routes:");
console.log("  /error              - Basic error with Deno context");
console.log("  /error-html         - HTML error page");
console.log("  /error-json         - JSON API error response");
console.log("  /deno-specific      - Deno-specific features");

Deno.serve({ port }, async (request: Request) => {
    const url = new URL(request.url);

    // Helper function to create error responses
    async function createErrorResponse(error: unknown, solutionFinders: any[] = []) {
        try {
            // Create Deno-specific context
            const denoContext = {
                runtime: {
                    name: "Deno",
                    version: Deno.version.deno,
                    v8: Deno.version.v8,
                    typescript: Deno.version.typescript,
                },
                environment: {
                    deployId: Deno.env.get("DENO_DEPLOYMENT_ID"),
                    region: Deno.env.get("DENO_REGION"),
                    env: Deno.env.get("DENO_ENV") || "development",
                },
                permissions: {
                    read: await Deno.permissions.query({ name: "read" }),
                    write: await Deno.permissions.query({ name: "write" }),
                    net: await Deno.permissions.query({ name: "net" }),
                    env: await Deno.permissions.query({ name: "env" }),
                    run: await Deno.permissions.query({ name: "run" }),
                },
                request: {
                    method: request.method,
                    url: request.url,
                    headers: Object.fromEntries(request.headers.entries()),
                    userAgent: request.headers.get("user-agent"),
                },
            };

            // Create request context page (adapted for Deno Request)
            const mockNodeRequest = {
                method: request.method,
                url: request.url,
                headers: Object.fromEntries(request.headers.entries()),
            };

            const contextPage = await createRequestContextPage(mockNodeRequest as any, {
                context: denoContext,
                headerAllowlist: ["content-type", "accept", "user-agent", "x-forwarded-for"],
            });

            return new Response(
                await ono.toHTML(error as Error, {
                    content: [contextPage],
                    solutionFinders,
                    cspNonce: `deno-nonce-${Date.now()}`,
                    theme: "auto",
                }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "text/html",
                        "X-Deno-Version": Deno.version.deno,
                    },
                },
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
        return new Response(
            `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Deno + Ono Example</title>
                    <style>
                        body { font-family: system-ui, sans-serif; padding: 2rem; }
                        .route { margin: 0.5rem 0; padding: 0.5rem; border: 1px solid #ccc; }
                        .method { font-weight: bold; color: #2563eb; }
                    </style>
                </head>
                <body>
                    <h1>🚀 Deno + Ono Example Server</h1>
                    <p>Click on these routes to see different error scenarios:</p>
                    <div class="route">
                        <a href="/error"><span class="method">GET</span> /error</a> - Basic error with Deno context
                    </div>
                    <div class="route">
                        <a href="/deno-specific"><span class="method">GET</span> /deno-specific</a> - Deno-specific error
                    </div>
                    <div class="route">
                        <a href="/error-json"><span class="method">GET</span> /error-json</a> - JSON API error response
                    </div>
                </body>
            </html>
        `,
            {
                headers: { "Content-Type": "text/html" },
            },
        );
    }

    if (url.pathname === "/error") {
        try {
            await processDenoRequest();
        } catch (error) {
            return await createErrorResponse(error);
        }
    }

    if (url.pathname === "/deno-specific") {
        try {
            initializeDenoService();
        } catch (error) {
            // Add Deno-specific solution finder
            const denoSolutionFinder = {
                name: "deno-config-finder",
                priority: 100,
                handle: async (err: Error) => {
                    if (err.message.includes("DENO_DEPLOYMENT_ID")) {
                        return {
                            header: "Deno Deployment Configuration",
                            body: "Make sure to set the DENO_DEPLOYMENT_ID environment variable for your Deno Deploy project. You can find this in your Deno Deploy dashboard.",
                        };
                    }
                    if (err.message.includes("deno.json")) {
                        return {
                            header: "Deno Configuration File",
                            body: "Check your deno.json file for correct configuration. Make sure all import paths are properly mapped.",
                        };
                    }
                    return undefined;
                },
            };
            return await createErrorResponse(error, [denoSolutionFinder]);
        }
    }

    if (url.pathname === "/error-json") {
        try {
            await processDenoRequest();
        } catch (error) {
            const ansiResult = await ono.toANSI(error as Error);
            return new Response(
                JSON.stringify({
                    error: ansiResult.errorAnsi,
                    solution: ansiResult.solutionBox,
                    timestamp: new Date().toISOString(),
                    runtime: "Deno",
                    version: Deno.version.deno,
                }),
                {
                    status: 500,
                    headers: { "Content-Type": "application/json" },
                },
            );
        }
    }

    return new Response("Not Found", { status: 404 });
});
