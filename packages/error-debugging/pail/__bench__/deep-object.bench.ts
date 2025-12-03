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
import { bench, describe } from "vitest";
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
    bench(
        "pail server",
        async () => {
            serverPail.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            browserPail.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola server",
        async () => {
            serverConsola.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola browser",
        async () => {
            browserConsola.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "tslog",
        async () => {
            tsLog.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            bunyanNodeStream.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            winstonNodeStream.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            pinoDestination.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            pinoNodeStream.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            pinoMinLength.info(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma logger",
        async () => {
            ogmaLogger.log(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma json logger",
        async () => {
            ogmaJsonLogger.log(deep);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "diary",
        async () => {
            diaryLogger.info("info message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "roarr",
        async () => {
            log.info(deep, "message");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "rslog",
        async () => {
            rslogLogger.info(deep);
        },
        {
            iterations: 10_000,
        },
    );
});
