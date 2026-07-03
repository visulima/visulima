import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Finding } from "../src/types";

// Mock the native binding so the entry-point orchestrators (`scan`,
// `scanFiles`, `listRequiredValidators`) can be exercised without loading the
// real `.node` addon. We assert the JS orchestration (prepare → binding →
// postProcess + verbose diagnostics) rather than detection itself.
const scanMock = vi.fn<(...args: unknown[]) => Promise<Finding[]>>();
const scanFilesMock = vi.fn<(...args: unknown[]) => Promise<Finding[]>>();
const inspectRulesetMock = vi.fn<(...args: unknown[]) => unknown>();

vi.mock(import("../src/binding"), () => {
    return {
        binding: {
            inspectRuleset: (...args: unknown[]) => inspectRulesetMock(...args),
            scan: (...args: unknown[]) => scanMock(...args),
            scanFiles: (...args: unknown[]) => scanFilesMock(...args),
        },
    };
});

beforeEach(() => {
    scanMock.mockReset();
    scanFilesMock.mockReset();
    inspectRulesetMock.mockReset();
    scanMock.mockResolvedValue([]);
    scanFilesMock.mockResolvedValue([]);
    inspectRulesetMock.mockReturnValue([]);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("listRequiredValidators", () => {
    it("reports the transport validators present in the bundled ruleset", async () => {
        expect.assertions(2);

        const { listRequiredValidators } = await import("../src/index");
        const report = await listRequiredValidators();

        expect(report.length).toBeGreaterThan(0);
        // The report is sorted by descending rule count; entries carry a type.
        expect(report.every((entry) => typeof entry.type === "string")).toBe(true);
    });

    it("reflects an inline config's validators when extendBundled is false", async () => {
        expect.assertions(1);

        const { listRequiredValidators } = await import("../src/index");
        const report = await listRequiredValidators({
            config: {
                extendBundled: false,
                inline: {
                    rules: [
                        { id: "custom.aws", validation: { type: "AWS" } },
                        { id: "custom.mongo", validation: { type: "MongoDB" } },
                    ],
                },
            },
        });

        expect(report.map((entry) => entry.type).toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["AWS", "MongoDB"]);
    });

    it("ignores non-object entries in the resolved rules array", async () => {
        expect.assertions(1);

        const { listRequiredValidators } = await import("../src/index");
        const report = await listRequiredValidators({
            config: {
                extendBundled: false,
                inline: {
                    // eslint-disable-next-line unicorn/no-null -- exercising the runtime null guard for malformed rule arrays.
                    rules: [null, "garbage", { id: "ok", validation: { type: "GCP" } }] as never,
                },
            },
        });

        expect(report.map((entry) => entry.type)).toStrictEqual(["GCP"]);
    });
});

describe("scan / scanFiles — verbose diagnostics path", () => {
    it("runs the skipped-rule diagnostics before scanning when verbose is set", async () => {
        expect.assertions(2);

        // A skipped rule makes the diagnostics path emit a warning, proving the
        // `if (options?.verbose)` branch in `scan` ran.
        inspectRulesetMock.mockReturnValue([{ reason: "invalid regex", ruleId: "broken.rule" }]);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { scan } = await import("../src/index");
        const { resetDiagnosticsForTests } = await import("../src/diagnostics");

        resetDiagnosticsForTests();

        const findings = await scan(["some/path"], { verbose: true });

        expect(findings).toStrictEqual([]);
        // The diagnostics path logs a summary line naming the skipped rule.
        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("rule(s) skipped"));

        consoleError.mockRestore();
    });

    it("does not run diagnostics for a non-verbose scan", async () => {
        expect.assertions(2);

        const { scan } = await import("../src/index");
        const { resetDiagnosticsForTests } = await import("../src/diagnostics");

        resetDiagnosticsForTests();
        inspectRulesetMock.mockClear();

        await scan(["some/path"]);

        expect(scanMock).toHaveBeenCalledTimes(1);
        expect(inspectRulesetMock).not.toHaveBeenCalled();
    });

    it("runs the verbose diagnostics path for scanFiles too", async () => {
        expect.assertions(1);

        inspectRulesetMock.mockReturnValue([{ reason: "invalid regex", ruleId: "broken.rule" }]);

        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const { scanFiles } = await import("../src/index");
        const { resetDiagnosticsForTests } = await import("../src/diagnostics");

        resetDiagnosticsForTests();

        await scanFiles(["a.ts", "b.ts"], { verbose: true });

        expect(consoleError).toHaveBeenCalledWith(expect.stringContaining("rule(s) skipped"));

        consoleError.mockRestore();
    });
});
