import * as fs from "node:fs";

import { bench, describe } from "vitest";
import pino from "pino";
import { createConsola as createServerConsola } from "consola";
import { createConsola as createBrowserConsola } from "consola/browser";
import * as winston from "winston";
import bunyan from "bunyan";

import pkg from "../package.json";
import { createPail as createServerPail } from "@visulima/pail/server";
import { createPail as createBrowserPail } from "@visulima/pail/browser";
import { JsonReporter as ServerJsonReporter } from "@visulima/pail/server/reporter";
import { JsonReporter as BrowserJsonReporter } from "@visulima/pail/browser/reporter";
import { JsonBrowserConsolaReporter, JsonServerConsolaReporter } from "./utils";

const deep = Object.assign({}, pkg, { level: "info" });
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

describe("deep object", async () => {
    bench(
        "pail server",
        async () => {
            serverPail.info(deep);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pail browser",
        async () => {
            browserPail.info(deep);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "consola server",
        async () => {
            serverConsola.info(deep);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "consola browser",
        async () => {
            browserConsola.info(deep);
        },
        {
            iterations: 10000,
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
            iterations: 10000,
        },
    );

    bench(
        "winston node stream",
        async () => {
            winstonNodeStream.info(deep);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pino destination",
        async () => {
            pinoDestination.info(deep);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pino node stream",
        async () => {
            pinoNodeStream.info(deep);
        },
        {
            iterations: 10000,
        },
    );

    bench(
        "pino min length",
        async () => {
            pinoMinLength.info(deep);
        },
        {
            iterations: 10000,
        },
    );
});
