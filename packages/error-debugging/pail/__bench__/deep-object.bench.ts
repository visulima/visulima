import { createWriteStream } from "node:fs";
import { devNull } from "node:os";

import { Ogma } from "@ogma/logger";
import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter/json";
import package_ from "@visulima/pail/package.json";
import { createPail as createServerPail } from "@visulima/pail/server";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter/json";
import bunyan from "bunyan";
import { createConsola as createBrowserConsola, createConsola as createServerConsola } from "consola";
import { diary } from "diary";
import pino from "pino";
import { ROARR, Roarr as log } from "roarr";
import { logger as rslogLogger } from "rslog";
import type { ILogObj } from "tslog";
import { Logger } from "tslog";
// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test } from "vitest";
import { createLogger, transports } from "winston";

import { JsonBrowserConsolaReporter, JsonServerConsolaReporter } from "./utils";

const deep = { ...package_, level: "info" };
const wsDevelopmentNull = createWriteStream(devNull);

const serverPail = createServerPail({
    reporters: [new ServerJsonReporter()],
    throttle: 999_999_999,
});
const browserPail = createBrowserPail({
    reporters: [new BrowserJsonReporter()],
    throttle: 999_999_999,
});

const serverConsola = createServerConsola({
    reporters: [new JsonServerConsolaReporter()],
    stderr: wsDevelopmentNull,
    stdout: wsDevelopmentNull,
    throttle: 999_999_999,
});

const browserConsola = createBrowserConsola({
    reporters: [new JsonBrowserConsolaReporter()],
    throttle: 999_999_999,
});

const tsLog = new Logger<ILogObj>({
    hideLogPositionForProduction: true,
    minLevel: 0,
    // Write to /dev/null stream to match other loggers
    transport: [
        {
            write: (logObject) => {
                wsDevelopmentNull.write(`${JSON.stringify(logObject)}\n`);
            },
        },
    ],
    type: "hidden", // Don't log anything to console
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

const ogmaStream = createWriteStream(devNull);

const ogmaLogger = new Ogma({ stream: ogmaStream });
const ogmaJsonLogger = new Ogma({ json: true, stream: ogmaStream });

const diaryStream = createWriteStream(devNull);
const diarySink = (event) => {
    diaryStream.write(JSON.stringify(event));
};
const diaryLogger = diary("standard", diarySink);

// Configure roarr to write to /dev/null
ROARR.write = () => {
    // Logs are discarded for benchmarking
};

// Configure rslog to write to /dev/null
rslogLogger.override({
    debug: () => {},
    error: () => {},
    greet: () => {},
    info: () => {},
    log: () => {},
    ready: () => {},
    start: () => {},
    success: () => {},
    warn: () => {},
});

describe("deep object", async () => {
    test("pail server", async ({ bench }) => {
        await bench(
            "pail server",
            {
                iterations: 10_000,
            },
            async () => {
                serverPail.info(deep);
            },
        ).run();
    });

    test("pail browser", async ({ bench }) => {
        await bench(
            "pail browser",
            {
                iterations: 10_000,
            },
            async () => {
                browserPail.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("consola server", async ({ bench }) => {
        await bench(
            "consola server",
            {
                iterations: 10_000,
            },
            async () => {
                serverConsola.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("consola browser", async ({ bench }) => {
        await bench(
            "consola browser",
            {
                iterations: 10_000,
            },
            async () => {
                browserConsola.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("tslog", async ({ bench }) => {
        await bench(
            "tslog",
            {
                iterations: 10_000,
            },
            async () => {
                tsLog.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("bunyan node stream", async ({ bench }) => {
        await bench(
            "bunyan node stream",
            {
                iterations: 10_000,
            },
            async () => {
                bunyanNodeStream.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("winston node stream", async ({ bench }) => {
        await bench(
            "winston node stream",
            {
                iterations: 10_000,
            },
            async () => {
                winstonNodeStream.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("pino destination", async ({ bench }) => {
        await bench(
            "pino destination",
            {
                iterations: 10_000,
            },
            async () => {
                pinoDestination.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("pino node stream", async ({ bench }) => {
        await bench(
            "pino node stream",
            {
                iterations: 10_000,
            },
            async () => {
                pinoNodeStream.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("pino min length", async ({ bench }) => {
        await bench(
            "pino min length",
            {
                iterations: 10_000,
            },
            async () => {
                pinoMinLength.info(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("ogma logger", async ({ bench }) => {
        await bench(
            "ogma logger",
            {
                iterations: 10_000,
            },
            async () => {
                ogmaLogger.log(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("ogma json logger", async ({ bench }) => {
        await bench(
            "ogma json logger",
            {
                iterations: 10_000,
            },
            async () => {
                ogmaJsonLogger.log(deep);
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("diary", async ({ bench }) => {
        await bench(
            "diary",
            {
                iterations: 10_000,
            },
            async () => {
                diaryLogger.info("info message");
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("roarr", async ({ bench }) => {
        await bench(
            "roarr",
            {
                iterations: 10_000,
            },
            async () => {
                log.info(deep, "message");
            },
        ).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("rslog", async ({ bench }) => {
        await bench(
            "rslog",
            {
                iterations: 10_000,
            },
            async () => {
                rslogLogger.info(deep);
            },
        ).run();
    });
});
