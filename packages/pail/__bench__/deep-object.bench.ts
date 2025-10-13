import { createWriteStream } from "node:fs";

import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter";
import package_ from "@visulima/pail/package.json";
import { createPail as createServerPail } from "@visulima/pail/server";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter";
import bunyan from "bunyan";
import { createConsola as createBrowserConsola, createConsola as createServerConsola } from "consola";
import pino from "pino";
import { bench, describe } from "vitest";
import { createLogger, transports } from "winston";

import { JsonBrowserConsolaReporter, JsonServerConsolaReporter } from "./utils";

const deep = { ...package_, level: "info" };
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

    // bench("tslog", async () => {
    //     tsLog.info(deep);
    // }, {
    //     iterations: 10000
    // });

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
});
