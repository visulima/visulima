import { createWriteStream } from "node:fs";
import { devNull } from "node:os";

import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter/json";
import { createPail as createServerPail } from "@visulima/pail/server";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter/json";
import bunyan from "bunyan";
import pino from "pino";
import { ROARR, Roarr as log } from "roarr";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";
import { createLogger, transports } from "winston";

const wsDevelopmentNull = createWriteStream(devNull);

const serverPail = createServerPail({
    reporters: [new ServerJsonReporter()],
    stderr: wsDevelopmentNull,
    stdout: wsDevelopmentNull,
    throttle: 999_999_999,
});

const browserPail = createBrowserPail({
    reporters: [new BrowserJsonReporter()],
    throttle: 999_999_999,
});

const pinoNodeStream = pino(wsDevelopmentNull);
const pinoDestination = pino(pino.destination(devNull));
const pinoMinLength = pino(pino.destination({ dest: devNull, minLength: 4096, sync: false }));

const winstonNodeStream = createLogger({
    transports: [
        new transports.Stream({
            stream: createWriteStream(devNull),
        }),
    ],
});

const bunyanNodeStream = bunyan.createLogger({
    name: "myapp",
    streams: [
        {
            level: "trace",
            stream: wsDevelopmentNull,
        },
    ],
});

// Configure roarr to write to /dev/null
ROARR.write = () => {
    // Logs are discarded for benchmarking
};

describe("child creation", async () => {
    bench(
        "pail server",
        async () => {
            const child = serverPail.child();

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            const child = browserPail.child();

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            const child = bunyanNodeStream.child({ component: "test" });

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            const child = winstonNodeStream.child({ component: "test" });

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            const child = pinoDestination.child({ component: "test" });

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            const child = pinoNodeStream.child({ component: "test" });

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            const child = pinoMinLength.child({ component: "test" });

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "roarr",
        async () => {
            const child = log.child({ component: "test" });

            child.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );
});

describe("child child creation", async () => {
    bench(
        "pail server",
        async () => {
            const child = serverPail.child({ scope: ["api"] });
            const grandChild = child.child({ scope: ["users"] });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            const child = browserPail.child({ scope: ["api"] });
            const grandChild = child.child({ scope: ["users"] });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            const child = bunyanNodeStream.child({ component: "api" });
            const grandChild = child.child({ module: "users" });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            const child = winstonNodeStream.child({ component: "api" });
            const grandChild = child.child({ module: "users" });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            const child = pinoDestination.child({ component: "api" });
            const grandChild = child.child({ module: "users" });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            const child = pinoNodeStream.child({ component: "api" });
            const grandChild = child.child({ module: "users" });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            const child = pinoMinLength.child({ component: "api" });
            const grandChild = child.child({ module: "users" });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "roarr",
        async () => {
            const child = log.child({ component: "api" });
            const grandChild = child.child({ module: "users" });

            grandChild.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );
});

describe("child with overrides", async () => {
    bench(
        "pail server",
        async () => {
            const child = serverPail.child({ logLevel: "debug" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            const child = browserPail.child({ logLevel: "debug" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            const child = bunyanNodeStream.child({ component: "test" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            const child = winstonNodeStream.child({ component: "test" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            const child = pinoDestination.child({ component: "test" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            const child = pinoNodeStream.child({ component: "test" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            const child = pinoMinLength.child({ component: "test" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "roarr",
        async () => {
            const child = log.child({ component: "test" });

            child.debug("debug message");
        },
        {
            iterations: 10_000,
        },
    );
});
