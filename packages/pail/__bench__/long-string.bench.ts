import * as fs from "node:fs";
import { randomBytes } from "node:crypto";

import { Logger, ILogObj } from "tslog";
import { bench, describe } from "vitest";
import pino from "pino";
import { createConsola as createServerConsola } from "consola";
import { createConsola as createBrowserConsola } from "consola/browser";
import * as winston from "winston";
import bunyan from "bunyan";

import { createPail as createServerPail } from "@visulima/pail/server";
import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter";
import { JsonBrowserConsolaReporter, JsonServerConsolaReporter } from "./utils";

const wsDevNull = fs.createWriteStream("/dev/null");

const serverPail = createServerPail({
    throttle: 999999999,
    reporters: [new ServerJsonReporter()],
});
const browserPail = createBrowserPail({
    throttle: 999999999,
    reporters: [new BrowserJsonReporter()],
});

const serverConsola = createServerConsola({
    throttle: 999999999,
    stderr: wsDevNull,
    stdout: wsDevNull,
    reporters: [new JsonServerConsolaReporter()],
});

const browserConsola = createBrowserConsola({
    throttle: 999999999,
    reporters: [new JsonBrowserConsolaReporter()],
});

const tsLog: Logger<ILogObj> = new Logger({
    hideLogPositionForProduction: true,
    type: "json",
});

const pinoNodeStream = pino(wsDevNull);
const pinoDestination = pino(pino.destination("/dev/null"));
const pinoMinLength = pino(pino.destination({ dest: "/dev/null", sync: false, minLength: 4096 }));

const winstonNodeStream = winston.createLogger({
    transports: [
        new winston.transports.Stream({
            stream: fs.createWriteStream("/dev/null"),
        }),
    ],
});

const bunyanNodeStream = bunyan.createLogger({
    name: "myapp",
    streams: [
        {
            level: "trace",
            stream: wsDevNull,
        },
    ],
});

const longStr = randomBytes(2000).toString();

describe("long-string", async () => {
    bench(
        "pail server",
        async () => {
            serverPail.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pail browser",
        async () => {
            browserPail.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "consola server",
        async () => {
            serverConsola.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "consola browser",
        async () => {
            browserConsola.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "tslog",
        async () => {
            tsLog.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "bunyan node stream",
        async () => {
            bunyanNodeStream.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            winstonNodeStream.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pino destination",
        async () => {
            pinoDestination.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            pinoNodeStream.info(longStr);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pino min length",
        async () => {
            pinoMinLength.info(longStr);
        },
        {
            iterations: 10000,
        },
    );
});
