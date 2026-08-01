import process, { env } from "node:process";

import { describe, expect, it } from "vitest";

import { PailBrowser } from "../../../src/pail.browser";
import CallerProcessor from "../../../src/processor/caller/caller-processor";
import getCallerFilename from "../../../src/processor/caller/get-caller-filename";
import EnvironmentProcessor, { detectEnvironment } from "../../../src/processor/environment-processor";
import MessageFormatterProcessor from "../../../src/processor/message-formatter-processor";
import SamplingProcessor from "../../../src/processor/sampling-processor";
import { createMeta, MetaCaptureReporter } from "./helpers";

describe("processors in workerd", () => {
    describe("environmentProcessor", () => {
        it("reads platform hints from node:process env", () => {
            expect.assertions(3);

            env.SERVICE_NAME = "workerd-service";
            env.CF_PAGES_COMMIT_SHA = "abcdef1234567890";

            try {
                const detected = detectEnvironment();

                expect(detected.service).toBe("workerd-service");
                expect(detected.commit).toBe("abcdef1");
                // `process.pid` is shimmed by `nodejs_compat`; it must still be a number.
                expect(detected.pid).toBeTypeOf("number");
            } finally {
                delete env.SERVICE_NAME;
                delete env.CF_PAGES_COMMIT_SHA;
            }
        });

        it("attaches the detected environment to the log meta", () => {
            expect.assertions(2);

            const processor = new EnvironmentProcessor({ includePid: true, overrides: { service: "pinned" } });
            const enriched = processor.process(createMeta()) as ReturnType<EnvironmentProcessor["process"]> & {
                envStorage?: { pid?: number; service?: string };
            };

            expect(enriched.envStorage?.service).toBe("pinned");
            expect(enriched.envStorage?.pid).toBe(process.pid);
        });
    });

    describe("callerProcessor", () => {
        it("resolves a call site through V8's prepareStackTrace hook", () => {
            expect.assertions(3);

            const caller = getCallerFilename();

            expect(caller.fileName).toBeTypeOf("string");
            expect(caller.fileName).toContain("processors.test");
            expect(caller.columnNumber).toBeTypeOf("number");
        });

        it("restores Error.prepareStackTrace after use", () => {
            expect.assertions(2);

            const before = Error.prepareStackTrace;

            new CallerProcessor().process(createMeta());

            expect(Error.prepareStackTrace).toBe(before);
            expect(new Error("plain").stack).toBeTypeOf("string");
        });

        it("adds file information to a log record end to end", () => {
            expect.assertions(2);

            const reporter = new MetaCaptureReporter();
            const logger = new PailBrowser({ processors: [new CallerProcessor()], reporters: [reporter] });

            logger.info("with caller");

            const { file } = reporter.metas[0] as { file?: { column?: number; line?: number; name?: string } };

            expect(file).toStrictEqual({ column: expect.any(Number), line: expect.any(Number), name: expect.any(String) });
            // A resolved path proves workerd surfaced real call sites rather than the
            // "anonymous" fallback the helper uses when every frame is filtered out.
            expect(file?.name).not.toBe("anonymous");
        });
    });

    describe("samplingProcessor", () => {
        it("drops records marked by head sampling before they reach reporters", () => {
            expect.assertions(1);

            const reporter = new MetaCaptureReporter();
            const logger = new PailBrowser({
                processors: [new SamplingProcessor({ head: { informational: 0 } })],
                reporters: [reporter],
            });

            logger.info("sampled out");
            logger.error("kept");

            expect(reporter.messages).toStrictEqual(["kept"]);
        });

        it("force-keeps records matched by a tail condition", () => {
            expect.assertions(1);

            const reporter = new MetaCaptureReporter();
            const logger = new PailBrowser({
                processors: [
                    new SamplingProcessor({
                        head: { informational: 0 },
                        tail: [(meta) => meta.scope?.includes("critical") ?? false],
                    }),
                ],
                reporters: [reporter],
                scope: ["critical"],
            });

            logger.info("kept by tail sampling");

            expect(reporter.messages).toStrictEqual(["kept by tail sampling"]);
        });
    });

    describe("messageFormatterProcessor", () => {
        it("interpolates arguments without any Node-only formatting helpers", () => {
            expect.assertions(1);

            const reporter = new MetaCaptureReporter();
            const logger = new PailBrowser({ processors: [new MessageFormatterProcessor()], reporters: [reporter] });

            logger.info("hello %s, you are %d", "workerd", 42);

            expect(reporter.messages).toStrictEqual(["hello workerd, you are 42"]);
        });

        it("serializes objects through the configured stringify implementation", () => {
            expect.assertions(1);

            const reporter = new MetaCaptureReporter();
            const logger = new PailBrowser({ processors: [new MessageFormatterProcessor()], reporters: [reporter] });

            logger.info("payload %j", { nested: { value: 1 } });

            expect(String(reporter.messages[0])).toContain("\"nested\"");
        });
    });
});
