import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import runExclusiveProbe from "../../src/ink/probe-terminal";

const flush = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
};

describe(runExclusiveProbe, () => {
    it("runs a lone probe synchronously, so its listener is attached before the next statement", () => {
        expect.assertions(1);

        const stdin = new EventEmitter() as unknown as NodeJS.ReadableStream;
        let isStarted = false;

        void runExclusiveProbe(stdin, async () => {
            isStarted = true;

            return undefined;
        });

        // Deferring by even a microtask would let bytes arrive before the probe is listening.
        expect(isStarted).toBe(true);
    });

    it("holds a second probe until the first finishes", async () => {
        expect.assertions(2);

        const stdin = new EventEmitter() as unknown as NodeJS.ReadableStream;
        const order: string[] = [];
        const held = Promise.withResolvers<undefined>();

        const first = runExclusiveProbe(stdin, async () => {
            order.push("first:start");

            await held.promise;

            order.push("first:end");
        });

        const second = runExclusiveProbe(stdin, async () => {
            order.push("second:start");
        });

        await flush();

        // The kitty query and the palette query both read this stdin; overlapping them makes each
        // treat the other's answer as user input.
        expect(order).toStrictEqual(["first:start"]);

        held.resolve(undefined);
        await Promise.all([first, second]);

        expect(order).toStrictEqual(["first:start", "first:end", "second:start"]);
    });

    it("lets the next probe run after one rejects", async () => {
        expect.assertions(2);

        const stdin = new EventEmitter() as unknown as NodeJS.ReadableStream;

        const failing = runExclusiveProbe(stdin, async () => {
            throw new Error("terminal went away");
        });

        await expect(failing).rejects.toThrow("terminal went away");

        // A probe that blew up must not wedge the queue for every later feature.
        await expect(runExclusiveProbe(stdin, async () => "ok")).resolves.toBe("ok");
    });

    it("keeps separate streams independent", async () => {
        expect.assertions(1);

        const first = new EventEmitter() as unknown as NodeJS.ReadableStream;
        const second = new EventEmitter() as unknown as NodeJS.ReadableStream;
        const started: string[] = [];

        void runExclusiveProbe(first, async () => {
            started.push("first");

            await new Promise(() => undefined);
        });
        void runExclusiveProbe(second, async () => {
            started.push("second");
        });

        await flush();

        expect(started).toStrictEqual(["first", "second"]);
    });

    it("runs synchronously again once the queue has drained", async () => {
        expect.assertions(1);

        const stdin = new EventEmitter() as unknown as NodeJS.ReadableStream;

        await runExclusiveProbe(stdin, async () => undefined);
        await flush();

        let isStarted = false;

        void runExclusiveProbe(stdin, async () => {
            isStarted = true;

            return undefined;
        });

        // A probe that finished long ago must not leave a permanent microtask hop behind.
        expect(isStarted).toBe(true);
    });
});
