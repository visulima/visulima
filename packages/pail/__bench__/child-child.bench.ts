import * as fs from "node:fs";

import { bench, describe } from "vitest";
import pino from "pino";
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
}).child("property").child("child");
const browserPail = createBrowserPail({
    throttle: 999999999,
    reporters: [new BrowserJsonReporter()],
}).child("property").child("child");

const pinoNodeStream = pino(wsDevNull).child({ a: 'property' }).child({ sub: 'child' });
const pinoDestination = pino(pino.destination("/dev/null")).child({ a: 'property' }).child({ sub: 'child' });
const pinoMinLength = pino(pino.destination({ dest: "/dev/null", sync: false, minLength: 4096 })).child({ a: 'property' }).child({ sub: 'child' });

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
}).child({ a: 'property' }).child({ sub: 'child' });

describe("child child", async () => {
    bench("pail server", async () => {
        serverPail.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pail browser", async () => {
        browserPail.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("bunyan node stream", async () => {
        bunyanNodeStream.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("winston node stream", async () => {
        winstonNodeStream.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pino destination", async () => {
        pinoDestination.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pino node stream", async () => {
        pinoNodeStream.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pino min length", async () => {
        pinoMinLength.info({ hello: 'world' });
    }, {
        iterations: 10000
    });
});
