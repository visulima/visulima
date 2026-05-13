import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarshallFinding } from "../../src/security/marshalls/findings";
import { presentMarshallDecision } from "../../src/security/marshalls/decision-prompt";

const errorFinding: MarshallFinding = {
    marshall: "author",
    message: "publisher email is unverified",
    packageName: "demo",
    severity: "error",
};

const warningFinding: MarshallFinding = {
    marshall: "downloads",
    message: "fewer than 100 weekly downloads",
    packageName: "demo",
    severity: "warning",
};

/** Minimal in-memory output target so we can inspect what the countdown rendered. */
const makeOutput = (): { chunks: string[]; isTTY: boolean; write: (chunk: string) => void } => {
    const chunks: string[] = [];

    return {
        chunks,
        isTTY: true,
        write: (chunk: string): void => {
            chunks.push(chunk);
        },
    };
};

describe(presentMarshallDecision, () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns proceed: true when there are no findings", async () => {
        expect.assertions(1);

        const result = await presentMarshallDecision([]);

        expect(result).toStrictEqual({ proceed: true });
    });

    it("aborts with errors-present when strict and errors are present", async () => {
        expect.assertions(1);

        const result = await presentMarshallDecision([errorFinding], { strict: true });

        expect(result).toStrictEqual({ proceed: false, reason: "errors-present" });
    });

    it("aborts with errors-present when errors and CI", async () => {
        expect.assertions(1);

        const result = await presentMarshallDecision([errorFinding], { isCi: true, isTty: false });

        expect(result).toStrictEqual({ proceed: false, reason: "errors-present" });
    });

    it("aborts with non-tty when errors but no TTY and not CI", async () => {
        expect.assertions(1);

        const result = await presentMarshallDecision([errorFinding], { isCi: false, isTty: false });

        expect(result).toStrictEqual({ proceed: false, reason: "non-tty" });
    });

    it("prompts y/N for errors in interactive mode and proceeds on 'y'", async () => {
        expect.assertions(2);

        const readline = vi.fn(async () => "y");
        const result = await presentMarshallDecision([errorFinding], { isCi: false, isTty: true, readline });

        expect(readline).toHaveBeenCalledWith(expect.stringContaining("Proceed despite errors?"));
        expect(result).toStrictEqual({ proceed: true });
    });

    it("aborts on 'N' (or empty) at the error prompt", async () => {
        expect.assertions(1);

        const readline = vi.fn(async () => "");
        const result = await presentMarshallDecision([errorFinding], { isCi: false, isTty: true, readline });

        expect(result).toStrictEqual({ proceed: false, reason: "user-aborted" });
    });

    it("aborts with ci-strict when strict and warnings-only", async () => {
        expect.assertions(1);

        const result = await presentMarshallDecision([warningFinding], { strict: true });

        expect(result).toStrictEqual({ proceed: false, reason: "ci-strict" });
    });

    it("auto-proceeds silently on warnings-only in CI / non-TTY", async () => {
        expect.assertions(1);

        const result = await presentMarshallDecision([warningFinding], { isCi: true, isTty: false });

        expect(result).toStrictEqual({ proceed: true });
    });

    it("runs the countdown and proceeds in a TTY when warnings-only", async () => {
        expect.assertions(2);
        vi.useFakeTimers();

        const output = makeOutput();
        const promise = presentMarshallDecision([warningFinding], {
            countdownSeconds: 3,
            env: { TERM: "xterm-256color" },
            isCi: false,
            isTty: true,
            output,
        });

        await vi.advanceTimersByTimeAsync(3000);

        const result = await promise;

        expect(result).toStrictEqual({ proceed: true });
        // The animated countdown writes the "Continuing in Ns..." line at least once.
        expect(output.chunks.some((chunk) => chunk.includes("Continuing in"))).toBe(true);
    });

    it("requires explicit y/N when VIS_DISABLE_AUTO_CONTINUE is set", async () => {
        expect.assertions(2);

        const readline = vi.fn(async () => "y");
        const result = await presentMarshallDecision([warningFinding], {
            env: { VIS_DISABLE_AUTO_CONTINUE: "1" },
            isCi: false,
            isTty: true,
            readline,
        });

        expect(readline).toHaveBeenCalledWith(expect.stringContaining("Proceed despite warnings?"));
        expect(result).toStrictEqual({ proceed: true });
    });

    it("honors VIS_AUTO_CONTINUE_SECONDS when supplied", async () => {
        expect.assertions(1);
        vi.useFakeTimers();

        const output = makeOutput();
        const promise = presentMarshallDecision([warningFinding], {
            env: { TERM: "xterm-256color", VIS_AUTO_CONTINUE_SECONDS: "2" },
            isCi: false,
            isTty: true,
            output,
        });

        await vi.advanceTimersByTimeAsync(2000);

        await expect(promise).resolves.toStrictEqual({ proceed: true });
    });

    it("aborts via supplied signal during countdown (user-aborted)", async () => {
        expect.assertions(1);
        vi.useFakeTimers();

        const controller = new AbortController();
        const output = makeOutput();
        const promise = presentMarshallDecision([warningFinding], {
            countdownSeconds: 10,
            env: { TERM: "xterm-256color" },
            isCi: false,
            isTty: true,
            output,
            signal: controller.signal,
        });

        // Advance partway, then abort.
        await vi.advanceTimersByTimeAsync(1500);
        controller.abort();
        await vi.advanceTimersByTimeAsync(100);

        await expect(promise).resolves.toStrictEqual({ proceed: false, reason: "user-aborted" });
    });

    it("renders a single static line on dumb terminals (no \\r animation)", async () => {
        expect.assertions(2);
        vi.useFakeTimers();

        const output = makeOutput();
        const promise = presentMarshallDecision([warningFinding], {
            countdownSeconds: 2,
            env: { TERM: "dumb" },
            isCi: false,
            isTty: true,
            output,
        });

        await vi.advanceTimersByTimeAsync(2000);
        await promise;

        // Dumb terminal path emits a single "Warnings present..." line and no `\r`.
        expect(output.chunks.some((chunk) => chunk.includes("Warnings present"))).toBe(true);
        expect(output.chunks.some((chunk) => chunk.startsWith("\r"))).toBe(false);
    });
});
