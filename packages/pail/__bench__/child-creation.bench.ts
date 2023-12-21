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
});
const browserPail = createBrowserPail({
    throttle: 999999999,
    reporters: [new BrowserJsonReporter()],
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

describe("child creation", async () => {
    bench("pail server", async () => {
        const child = serverPail.child('property');

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pail browser", async () => {
        const child = browserPail.child('property');

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("bunyan node stream", async () => {
        const child = bunyanNodeStream.child({ a: 'property' });

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("winston node stream", async () => {
        const child = winstonNodeStream.child({ a: 'property' });

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pino destination", async () => {
        const child = pinoDestination.child({ a: 'property' });

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pino node stream", async () => {
        const child = pinoNodeStream.child({ a: 'property' });

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });

    bench("pino min length", async () => {
        const child = pinoMinLength.child({ a: 'property' });

        child.info({ hello: 'world' });
    }, {
        iterations: 10000
    });
});
