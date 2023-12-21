import * as fs from "node:fs";

import { Logger, ILogObj } from "tslog";
import { bench, describe } from "vitest";
import pino from "pino";
import { ConsolaReporter, createConsola as createBasicConsola } from "consola/basic";
import { createConsola as createServerConsola } from "consola";
import { createConsola as createBrowserConsola } from "consola/browser";
import * as winston from "winston";
import bunyan from "bunyan";

import { createPail as createServerPail } from "../src/index.server";
import { createPail as createBrowserPail } from "../src/index.browser";
import ServerJsonReporter from "../src/reporter/json/json.server";
import BrowserJsonReporter from "../src/reporter/json/json.browser";

const wsDevNull = fs.createWriteStream("/dev/null");

const serverPail = createServerPail({
    throttle: 999999999,
    reporters: [new ServerJsonReporter()],
});
const browserPail = createBrowserPail({
    throttle: 999999999,
    reporters: [new BrowserJsonReporter()],
});

const basicConsola = createBasicConsola({
    throttle: 999999999,
    // Kind of the same interface as Pail
    reporters: [new ServerJsonReporter() as ConsolaReporter],
});

const serverConsola = createServerConsola({
    throttle: 999999999,
    // Kind of the same interface as Pail
    reporters: [new ServerJsonReporter() as ConsolaReporter],
});

const browserConsola = createBrowserConsola({
    throttle: 999999999,
    // Kind of the same interface as Pail
    reporters: [new BrowserJsonReporter() as ConsolaReporter],
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

describe("basic", async () => {
    bench("pail server", async () => {
        serverPail.info("hello world");
    }, {
        iterations: 10000
    });

    bench("pail browser", async () => {
        browserPail.info("hello world");
    }, {
        iterations: 10000
    });

    bench("consola basic", async () => {
        basicConsola.info("hello world");
    }, {
        iterations: 10000
    });

    bench("consola server", async () => {
        serverConsola.info("hello world");
    }, {
        iterations: 10000
    });

    bench("consola browser", async () => {
        browserConsola.info("hello world");
    }, {
        iterations: 10000
    });

    bench("tslog", async () => {
        tsLog.info("hello world");
    }, {
        iterations: 10000
    });

    bench("bunyan node stream", async () => {
        bunyanNodeStream.info("hello world");
    }, {
        iterations: 10000
    });

    bench("winston node stream", async () => {
        winstonNodeStream.info("hello world");
    }, {
        iterations: 10000
    });

    bench("pino destination", async () => {
        pinoDestination.info("hello world");
    }, {
        iterations: 10000
    });

    bench("pino node stream", async () => {
        pinoNodeStream.info("hello world");
    }, {
        iterations: 10000
    });

    bench("pino min length", async () => {
        pinoMinLength.info("hello world");
    }, {
        iterations: 10000
    });
});
