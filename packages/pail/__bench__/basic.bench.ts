import { createWriteStream } from "node:fs";
import { devNull } from "node:os";

import { Signale } from "@dynamicabot/signales";
import { Ogma } from "@ogma/logger";
import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter/json";
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

const wsDevelopmentNull2 = createWriteStream(devNull);

wsDevelopmentNull2.on("finish", () => {
    // eslint-disable-next-line no-console
    console.log("finish");
});

const serverConsola = createServerConsola({
    reporters: [new JsonServerConsolaReporter()],
    stderr: wsDevelopmentNull2,
    stdout: wsDevelopmentNull2,
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

const signale = new Signale({
    stream: wsDevelopmentNull,
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
    log: () => {},
    info: () => {},
    start: () => {},
    ready: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    greet: () => {},
});

describe("basic", async () => {
    bench(
        "signale",
        async () => {
            signale.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail server",
        async () => {
            serverPail.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            browserPail.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola server",
        async () => {
            serverConsola.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola browser",
        async () => {
            browserConsola.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "tslog",
        async () => {
            tsLog.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            bunyanNodeStream.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            winstonNodeStream.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            pinoDestination.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            pinoNodeStream.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            pinoMinLength.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma logger",
        async () => {
            ogmaLogger.log("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma json logger",
        async () => {
            ogmaJsonLogger.log("hello world");
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
            log.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "rslog",
        async () => {
            rslogLogger.info("hello world");
        },
        {
            iterations: 10_000,
        },
    );
});
