import { serve } from "@hono/node-server";
// @ts-ignore - resolved after build: dist/handler/fetch-handler.mjs is generated
import fetchHandler from "@visulima/error-handler/dist/handler/http/fetch-handler.js";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => c.text("OK"));
app.get("/error", () => {
    throw new Error("Boom from Hono");
});

// Handle errors via fetch-based handler
app.onError(async (error, c) => {
    const handler = await fetchHandler(/** @type {Error} */ error, { showTrace: true });

    return handler(c.req.raw);
});

// No Node bridging helpers needed when using @hono/node-server

serve({
    fetch: app.fetch,
    port: 3000,
});
console.log("Hono + running at http://localhost:3000");
console.log("Try http://localhost:3000/error");
