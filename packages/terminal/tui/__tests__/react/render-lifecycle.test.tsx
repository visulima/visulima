import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, renderInline } from "../../src/react/react";

/**
 * Lifecycle coverage for the public ./react entry points. The native binding is
 * stubbed by `__tests__/setup.ts`; here we also stub the process.stdin stream so
 * the parsers/loops don't touch the real TTY. Regression guard for finding tui-1:
 * unmount() must hand control back (resolve waitUntilExit) instead of exiting.
 */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const stubProcessIo = () => {
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(process.stdin, "on").mockReturnValue(process.stdin);
    vi.spyOn(process.stdin, "off").mockReturnValue(process.stdin);
    vi.spyOn(process.stdin, "removeListener").mockReturnValue(process.stdin);
    vi.spyOn(process.stdin, "resume").mockReturnValue(process.stdin);
    vi.spyOn(process.stdin, "pause").mockReturnValue(process.stdin);
    vi.spyOn(process.stdin, "setEncoding").mockReturnValue(process.stdin);
};

describe("react/react lifecycle", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderInline unmount() resolves waitUntilExit without exiting the process", async () => {
        expect.assertions(2);

        stubProcessIo();

        const instance = renderInline(React.createElement("box", null, "hi"), { rows: 3 });

        let resolved = false;

        void instance.waitUntilExit().then(() => {
            resolved = true;
        });

        instance.unmount();
        await flush();

        expect(resolved).toBe(true);
        expect(process.exit).not.toHaveBeenCalled();
    });

    it("render unmount() resolves waitUntilExit without exiting the process", async () => {
        expect.assertions(2);

        stubProcessIo();

        const instance = render(React.createElement("box", null, "hi"));

        let resolved = false;

        void instance.waitUntilExit().then(() => {
            resolved = true;
        });

        instance.unmount();
        await flush();

        expect(resolved).toBe(true);
        expect(process.exit).not.toHaveBeenCalled();
    });

    it("keeps two concurrent inline instances independently live", async () => {
        expect.assertions(2);

        stubProcessIo();

        // Mounting a second instance used to steal the first's commit callback
        // (finding tui-4). Both must be able to unmount and resolve cleanly.
        const first = renderInline(React.createElement("box", null, "a"), { rows: 2 });
        const second = renderInline(React.createElement("box", null, "b"), { rows: 2 });

        let firstResolved = false;
        let secondResolved = false;

        void first.waitUntilExit().then(() => {
            firstResolved = true;
        });
        void second.waitUntilExit().then(() => {
            secondResolved = true;
        });

        first.unmount();
        second.unmount();
        await flush();

        expect(firstResolved).toBe(true);
        expect(secondResolved).toBe(true);
    });
});
