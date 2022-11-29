// eslint-disable-next-line import/no-extraneous-dependencies
// import Cors from "cors";
// eslint-disable-next-line import/no-extraneous-dependencies
import express, { Express } from "express";

type Authorized<T> = T & { user?: any };

const app: Express = express();

app.use((_request: Authorized<express.Request>, _response, next) => {
    next();
});

// eslint-disable-next-line no-console
app.on("error", console.error);

// eslint-disable-next-line no-console
process.on("uncaughtException", console.error);

export default app;
