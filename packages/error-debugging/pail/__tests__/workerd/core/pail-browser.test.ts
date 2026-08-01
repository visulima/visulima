import process from "node:process";

import { describe, expect, it } from "vitest";

import { PailBrowser } from "../../../src/pail.browser";
import { messageToText, MetaCaptureReporter } from "./helpers";

const TIMER_MESSAGE_REGEX = /^Timer run for: \d+ ms$/;

describe("pailBrowser core pipeline in workerd", () => {
    it("filters by log level and honours the force channel", () => {
        expect.assertions(2);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ logLevel: "error", reporters: [reporter] });

        logger.info("dropped");
        logger.error("kept");
        logger.force.info("forced through");

        expect(reporter.messages).toStrictEqual(["kept", "forced through"]);
        expect(reporter.metas[1].type.name).toBe("info");
    });

    it("queues while paused and flushes in order on resume", () => {
        expect.assertions(2);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter] });

        logger.pause();
        logger.info("first");
        logger.info("second");

        expect(reporter.messages).toStrictEqual([]);

        logger.resume();

        expect(reporter.messages).toStrictEqual(["first", "second"]);
    });

    it("stops reporting when disabled and resumes when enabled", () => {
        expect.assertions(3);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter] });

        logger.disable();

        expect(logger.isEnabled()).toBe(false);

        logger.info("dropped");
        logger.enable();
        logger.info("kept");

        expect(logger.isEnabled()).toBe(true);
        expect(reporter.messages).toStrictEqual(["kept"]);
    });

    it("throttles repeated logs using Date and setTimeout", async () => {
        expect.assertions(2);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter], throttle: 200, throttleMin: 2 });

        for (let index = 0; index < 6; index += 1) {
            logger.info("repeated");
        }

        // throttleMin + 1 records make it through before the dedup window kicks in.
        expect(reporter.metas).toHaveLength(3);

        // workerd advances timers on I/O; the deferred flush must still fire.
        await new Promise((resolve) => {
            setTimeout(resolve, 400);
        });

        expect(reporter.metas.at(-1)?.repeated).toBe(3);
    });

    it("tracks console groups internally because workerd has no window", () => {
        expect.assertions(2);

        expect(globalThis.window).toBeUndefined();

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter] });

        logger.group("outer");
        logger.info("grouped");

        expect(reporter.metas[0].groups).toStrictEqual(["outer"]);

        logger.groupEnd();
    });

    it("emits timer lifecycle records with a monotonic-enough Date clock", async () => {
        expect.assertions(3);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter] });

        logger.time("workerd-timer");

        await new Promise((resolve) => {
            setTimeout(resolve, 10);
        });

        logger.timeEnd("workerd-timer");

        expect(reporter.metas[0].type.name).toBe("start");
        expect(reporter.metas[1].type.name).toBe("stop");
        expect(messageToText(reporter.metas[1].message)).toMatch(TIMER_MESSAGE_REGEX);
    });

    it("counts and resets counters", () => {
        expect.assertions(1);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter], throttle: 0 });

        logger.count("hits");
        logger.count("hits");
        logger.countReset("hits");
        logger.count("hits");

        expect(reporter.messages).toStrictEqual(["hits: 1", "hits: 2", "hits: 1"]);
    });

    it("wraps and restores the workerd console by behaviour", () => {
        expect.assertions(5);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter] });

        logger.wrapConsole();

        // Pail-only types are added to console and recorded for removal.
        expect(Object.hasOwn(console, "__log")).toBe(true);
        expect(Object.hasOwn(console, "success")).toBe(true);

        // eslint-disable-next-line no-console
        console.log("through pail");

        expect(reporter.messages).toStrictEqual(["through pail"]);

        logger.restoreConsole();

        // eslint-disable-next-line no-console
        console.log("after restore");

        // workerd's `console` is an exotic object: assigning a function to it stores a
        // re-bound copy, so identity comparisons (`console.log === original`) can never
        // hold. Assert the restored *behaviour* instead — nothing else reaches the logger.
        expect(reporter.messages).toStrictEqual(["through pail"]);
        expect(Object.hasOwn(console, "success")).toBe(false);
    });

    it("registers and removes node:process exception handlers exactly once", () => {
        expect.assertions(4);

        const logger = new PailBrowser({ reporters: [new MetaCaptureReporter()] });

        const uncaughtBefore = process.listenerCount("uncaughtException");
        const rejectionBefore = process.listenerCount("unhandledRejection");

        logger.wrapException();

        expect(process.listenerCount("uncaughtException")).toBe(uncaughtBefore + 1);

        // Second call must not stack a duplicate listener.
        logger.wrapException();

        expect(process.listenerCount("uncaughtException")).toBe(uncaughtBefore + 1);

        logger.restoreException();

        expect(process.listenerCount("uncaughtException")).toBe(uncaughtBefore);
        expect(process.listenerCount("unhandledRejection")).toBe(rejectionBefore);
    });

    it("reports an unhandled rejection through the logger when workerd emits one", () => {
        expect.assertions(1);

        const reporter = new MetaCaptureReporter();
        const logger = new PailBrowser({ reporters: [reporter] });

        logger.wrapException();

        try {
            const error = new Error("rejected");

            process.emit("unhandledRejection", error, Promise.resolve());

            expect(reporter.metas[0]?.error).toBe(error);
        } finally {
            logger.restoreException();
        }
    });
});
