import type { Express } from "express";
import express from "express";

type Authorized<T> = T & { user?: Record<string, unknown> };

const app: Express = express();

// Disable X-Powered-By header to avoid version disclosure
app.disable("x-powered-by");

// Express automatically sets originalUrl when using app.use() - no need to set it manually
app.use((_request: Authorized<express.Request>, _response, next) => {
    next();
});

// eslint-disable-next-line no-console
app.on("error", console.error);

// eslint-disable-next-line no-console
process.on("uncaughtException", console.error);

export default app;
