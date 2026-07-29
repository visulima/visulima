import { afterEach, describe, expect, it, vi } from "vitest";

import { createInlineLoop } from "../../src/core/inline";

/**
 * The global test setup (`__tests__/setup.ts`) mocks `../src/core/native-binding`
 * so `Renderer`/`terminalSize` are no-op stubs — no compiled `.node` is required.
 * These tests exercise the loop's lifecycle, not its rendering output.
 */
describe("core/inline createInlineLoop", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("stops without terminating the process and invokes onStop", () => {
        expect.assertions(3);

        const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

        vi.spyOn(process.stdin, "on").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "off").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "resume").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "pause").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "setEncoding").mockReturnValue(process.stdin);

        const onStop = vi.fn();
        const loop = createInlineLoop(() => {}, { onStop, rows: 4 });

        loop.start();
        loop.stop();

        expect(onStop).toHaveBeenCalledTimes(1);
        // A public ./core API must never kill the host process on stop.
        expect(exitSpy).not.toHaveBeenCalled();
        expect(process.stdin.pause).toHaveBeenCalled();
    });

    it("detaches its SIGINT handler on stop", () => {
        expect.assertions(1);

        vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
        vi.spyOn(process.stdin, "on").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "off").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "resume").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "pause").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "setEncoding").mockReturnValue(process.stdin);

        const processOff = vi.spyOn(process, "off");

        const loop = createInlineLoop(() => {}, { rows: 4 });

        loop.start();
        loop.stop();

        expect(processOff).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    });

    it("is idempotent — a second stop() does not re-run onStop", () => {
        expect.assertions(1);

        vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
        vi.spyOn(process.stdin, "on").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "off").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "resume").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "pause").mockReturnValue(process.stdin);
        vi.spyOn(process.stdin, "setEncoding").mockReturnValue(process.stdin);

        const onStop = vi.fn();
        const loop = createInlineLoop(() => {}, { onStop, rows: 4 });

        loop.start();
        loop.stop();
        loop.stop();

        expect(onStop).toHaveBeenCalledTimes(1);
    });
});
