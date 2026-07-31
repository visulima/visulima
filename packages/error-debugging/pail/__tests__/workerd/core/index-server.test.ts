import { env, stderr, stdout } from "node:process";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createPail, pail } from "../../../src/index.server";
import { MetaCaptureReporter } from "./helpers";

const withEnvironment = <T>(patch: Record<string, string | undefined>, run: () => T): T => {
    const previous: Record<string, string | undefined> = {};

    for (const key of Object.keys(patch)) {
        previous[key] = env[key];

        if (patch[key] === undefined) {
            Reflect.deleteProperty(env, key);
        } else {
            env[key] = patch[key];
        }
    }

    try {
        return run();
    } finally {
        for (const key of Object.keys(previous)) {
            if (previous[key] === undefined) {
                Reflect.deleteProperty(env, key);
            } else {
                env[key] = previous[key];
            }
        }
    }
};

describe("index.server in workerd", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("exposes node:process env as a mutable record", () => {
        expect.assertions(2);

        // `nodejs_compat` maps worker bindings onto `process.env`. NODE_ENV is not set
        // by the runtime, so `getDefaultLogLevel()` must fall through to its default
        // rather than assuming a Node-style environment.
        expect(env).toBeTypeOf("object");

        withEnvironment({ PAIL_WORKERD_PROBE: "yes" }, () => {
            expect(env.PAIL_WORKERD_PROBE).toBe("yes");
        });
    });

    it("creates a usable logger that writes to the node:process streams", () => {
        expect.assertions(2);

        const outSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);
        const errorSpy = vi.spyOn(stderr, "write").mockImplementation(() => true);

        const logger = createPail();

        logger.info("workerd default reporter");
        logger.error(new Error("workerd failure"));

        expect(outSpy.mock.calls.map((call) => String(call[0])).join("")).toContain("workerd default reporter");
        expect(errorSpy.mock.calls.map((call) => String(call[0])).join("")).toContain("workerd failure");
    });

    it("evaluates the eagerly constructed `pail` export at import time", () => {
        expect.assertions(2);

        const outSpy = vi.spyOn(stdout, "write").mockImplementation(() => true);

        expect(pail.info).toBeTypeOf("function");

        pail.info("module scope logger");

        expect(outSpy.mock.calls.map((call) => String(call[0])).join("")).toContain("module scope logger");
    });

    it("reads the log level from PAIL_LOG_LEVEL in node:process env", () => {
        expect.assertions(2);

        const reporter = new MetaCaptureReporter();

        withEnvironment({ DEBUG: undefined, NODE_ENV: undefined, PAIL_LOG_LEVEL: "error" }, () => {
            const logger = createPail({ reporters: [reporter] });

            logger.info("suppressed");
            logger.error("kept");
        });

        expect(reporter.messages).toStrictEqual(["kept"]);
        expect(reporter.metas[0].type.level).toBe("error");
    });

    it("falls back to the informational level when no environment hints are present", () => {
        expect.assertions(1);

        const reporter = new MetaCaptureReporter();

        withEnvironment({ DEBUG: undefined, NODE_ENV: undefined, PAIL_LOG_LEVEL: undefined }, () => {
            const logger = createPail({ reporters: [reporter] });

            logger.debug("dropped below informational");
            logger.info("kept at informational");
        });

        expect(reporter.messages).toStrictEqual(["kept at informational"]);
    });

    it("switches to debug when DEBUG is set in node:process env", () => {
        expect.assertions(1);

        const reporter = new MetaCaptureReporter();

        withEnvironment({ DEBUG: "1", NODE_ENV: undefined, PAIL_LOG_LEVEL: undefined }, () => {
            const logger = createPail({ reporters: [reporter] });

            logger.debug("visible in debug mode");
        });

        expect(reporter.messages).toStrictEqual(["visible in debug mode"]);
    });
});
