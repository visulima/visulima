import { createWriteStream } from "node:fs";

import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { diary } from "diary";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter";
import { createPail as createServerPail } from "@visulima/pail/server";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter";
import { Ogma } from "@ogma/logger";
import bunyan from "bunyan";
import { createConsola as createBrowserConsola, createConsola as createServerConsola } from "consola";
import pino from "pino";
import type { ILogObj } from "tslog";
import { Logger } from "tslog";
import { bench, describe } from "vitest";
import { createLogger, transports } from "winston";

import { JsonBrowserConsolaReporter, JsonServerConsolaReporter } from "./utils";

const wsDevelopmentNull = createWriteStream("/dev/null");

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
    type: "hidden", // Don't log anything to console
    minLevel: 0,
    // Write to /dev/null stream to match other loggers
    transport: [
        {
            write: (logObject) => {
                wsDevelopmentNull.write(JSON.stringify(logObject) + '\n');
            },
        },
    ],
});

const pinoNodeStream = pino(wsDevelopmentNull);
const pinoDestination = pino(pino.destination("/dev/null"));
const pinoMinLength = pino(pino.destination({ dest: "/dev/null", minLength: 4096, sync: false }));

const winstonNodeStream = createLogger({
    transports: [
        new transports.Stream({
            stream: createWriteStream("/dev/null"),
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

const ogmaStream = createWriteStream("/dev/null");

const ogmaLogger = new Ogma({ stream: ogmaStream });
const ogmaJsonLogger = new Ogma({ json: true, stream: ogmaStream });

const diaryStream = createWriteStream("/dev/null");
const diarySink = (event) => {
    diaryStream.write(JSON.stringify(event));
};
const diaryLogger = diary("standard", diarySink);

describe("object", async () => {
    bench(
        "pail server",
        async () => {
            serverPail.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pail browser",
        async () => {
            browserPail.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola server",
        async () => {
            serverConsola.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "consola browser",
        async () => {
            browserConsola.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "tslog",
        async () => {
            tsLog.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            bunyanNodeStream.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            winstonNodeStream.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino destination",
        async () => {
            pinoDestination.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            pinoNodeStream.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "pino min length",
        async () => {
            pinoMinLength.info({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma logger",
        async () => {
            ogmaLogger.log({ hello: "world" });
        },
        {
            iterations: 10_000,
        },
    );

    bench(
        "ogma json logger",
        async () => {
            ogmaJsonLogger.log({ hello: "world" });
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
