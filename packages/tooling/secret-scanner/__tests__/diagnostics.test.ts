import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDiagnosticsForTests, warnOnSkippedRules } from "../src/diagnostics";

// `warnOnSkippedRules` calls `binding.inspectRuleset(resolved)`. We exercise
// the function via its public API and mock the native binding by spying on
// `console.error` to observe the warning shape. The binding module is
// re-imported after `vi.doMock` so the `binding` proxy inside
// `src/diagnostics.ts` picks up the mock.
const mockInspect = vi.fn<(...args: unknown[]) => unknown>();

vi.mock(import("../src/binding"), () => {
    return {
        binding: {
            inspectRuleset: (...args: unknown[]) => mockInspect(...args),
        },
    };
});

beforeEach(() => {
    resetDiagnosticsForTests();
    mockInspect.mockReset();
});

const nativeOptionsStub = {} as unknown as Parameters<typeof warnOnSkippedRules>[0];

describe(warnOnSkippedRules, () => {
    it("is silent when no rules were skipped", async () => {
        expect.assertions(2);

        mockInspect.mockReturnValue([]);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await warnOnSkippedRules(nativeOptionsStub);

        expect(mockInspect).toHaveBeenCalledTimes(1);
        expect(consoleError).not.toHaveBeenCalled();

        consoleError.mockRestore();
    });

    it("writes one banner + one line per skipped rule (up to 10) + an overflow note", async () => {
        expect.assertions(2);

        mockInspect.mockReturnValue(
            Array.from({ length: 12 }, (_, i) => {
                return { reason: `invalid at ${String(i)}`, ruleId: `rule-${String(i)}` };
            }),
        );

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await warnOnSkippedRules(nativeOptionsStub);

        // 1 banner + 10 entries + 1 "... and 2 more" line = 12 calls.
        expect(consoleError).toHaveBeenCalledTimes(12);

        const lastCall = consoleError.mock.calls.at(-1)?.[0];

        expect(lastCall).toContain("and 2 more");

        consoleError.mockRestore();
    });

    it("runs once per process (repeat calls are no-ops)", async () => {
        expect.assertions(1);

        mockInspect.mockReturnValue([{ reason: "bad", ruleId: "r" }]);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await warnOnSkippedRules(nativeOptionsStub);
        await warnOnSkippedRules(nativeOptionsStub);
        await warnOnSkippedRules(nativeOptionsStub);

        // Only the first call invokes `inspectRuleset`; later calls short-circuit on `warnedOnce`.
        expect(mockInspect).toHaveBeenCalledTimes(1);

        consoleError.mockRestore();
    });

    it("swallows errors from the native side — diagnostics are best-effort", async () => {
        expect.assertions(1);

        mockInspect.mockImplementation(() => {
            throw new Error("native down");
        });

        await expect(warnOnSkippedRules(nativeOptionsStub)).resolves.toBeUndefined();
    });
});
