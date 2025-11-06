import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { devNull } from "node:os";

import { Ogma } from "@ogma/logger";
import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter/json";
import { createPail as createServerPail } from "@visulima/pail/server";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter/json";
import bunyan from "bunyan";
import { createConsola as createBrowserConsola, createConsola as createServerConsola } from "consola";
import { diary } from "diary";
import pino from "pino";
import type { ILogObj } from "tslog";
import { Logger } from "tslog";
// eslint-disable-next-line import/no-extraneous-dependencies
import { bench, describe } from "vitest";
import { createLogger, transports } from "winston";

import { JsonBrowserConsolaReporter, JsonServerConsolaReporter } from "./utils";

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

const longString = randomBytes(2000).toString();

describe("long-string", async () => {
    bench(
        "pail server",
        async () => {
            serverPail.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            browserPail.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola server",
        async () => {
            serverConsola.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola browser",
        async () => {
            browserConsola.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "tslog",
        async () => {
            tsLog.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            bunyanNodeStream.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            winstonNodeStream.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            pinoDestination.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            pinoNodeStream.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            pinoMinLength.info(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma logger",
        async () => {
            ogmaLogger.log(longString);
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma json logger",
        async () => {
            ogmaJsonLogger.log(longString);
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
});
