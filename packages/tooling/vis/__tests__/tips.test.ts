import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TipContext } from "../src/util/tips";

vi.mock(import("is-in-ci"), () => {
    return { default: false };
});

const { showTip, tips } = await import("../src/util/tips");

describe("showTip", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        delete process.env.VIS_CLI_TEST;
    });

    afterEach(() => {
        stderrSpy.mockRestore();
    });

    it("should not show tips when VIS_CLI_TEST is set", () => {
        expect.assertions(1);

        process.env.VIS_CLI_TEST = "1";
        showTip({ args: ["install"], command: "install", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });

    it("should not show tips when CI is set", async () => {
        expect.assertions(1);

        // is-in-ci evaluates at import time, so we reset modules, re-mock, and re-import
        vi.resetModules();
        vi.doMock(import("is-in-ci"), () => {
            return { default: true };
        });
        const { showTip: showTipCi } = await import("../src/util/tips");

        showTipCi({ args: ["install"], command: "install", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();

        vi.resetModules();
        vi.doMock(import("is-in-ci"), () => {
            return { default: false };
        });
    });
});

describe("tip definitions", () => {
    it("should have unique ids for all tips", () => {
        expect.assertions(1);

        const ids = tips.map((t) => t.id);
        const unique = new Set(ids);

        expect(unique.size).toBe(ids.length);
    });

    it("should have valid probabilities (0-1 range)", () => {
        expect.assertions(1);

        const allValid = tips.every((t) => {
            const p = t.probability ?? 1;

            return p >= 0 && p <= 1;
        });

        expect(allValid).toBe(true);
    });

    it("should have non-negative cooldowns", () => {
        expect.assertions(1);

        const allValid = tips.every((t) => {
            const c = t.cooldownMs ?? 0;

            return c >= 0;
        });

        expect(allValid).toBe(true);
    });
});

describe("tip matching", () => {
    const makeContext = (command: string, args: string[] = [], success = true): TipContext => {
        return {
            args: [command, ...args],
            command,
            success,
        };
    };

    it("short-aliases should match install command", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "short-aliases")!;

        expect(tip.matches(makeContext("install"))).toBe(true);
    });

    it("short-aliases should match remove command", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "short-aliases")!;

        expect(tip.matches(makeContext("remove"))).toBe(true);
    });

    it("short-aliases should not match run command", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "short-aliases")!;

        expect(tip.matches(makeContext("run"))).toBe(false);
    });

    it("use-exec should match successful dlx", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "use-exec")!;

        expect(tip.matches(makeContext("dlx"))).toBe(true);
    });

    it("use-exec should not match failed dlx", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "use-exec")!;

        expect(tip.matches(makeContext("dlx", [], false))).toBe(false);
    });

    it("security-check should not match when --security already present", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "security-check")!;

        expect(tip.matches(makeContext("check", ["--security"]))).toBe(false);
    });

    it("ai-analysis should not match when --ai already present", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "ai-analysis")!;

        expect(tip.matches(makeContext("update", ["--ai"]))).toBe(false);
    });

    it("affected-command should match run without --projects", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "affected-command")!;

        expect(tip.matches(makeContext("run"))).toBe(true);
    });

    it("affected-command should not match run with --projects", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "affected-command")!;

        expect(tip.matches(makeContext("run", ["--projects"]))).toBe(false);
    });

    it("why-command should match successful outdated", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "why-command")!;

        expect(tip.matches(makeContext("outdated"))).toBe(true);
    });

    it("create-editor should match successful create", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "create-editor")!;

        expect(tip.matches(makeContext("create"))).toBe(true);
    });
});

describe("tip messages", () => {
    const makeContext = (command: string): TipContext => {
        return {
            args: [command],
            command,
            success: true,
        };
    };

    it("short-aliases should return alias for install", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "short-aliases")!;
        const msg = tip.message(makeContext("install"));

        expect(msg).toContain("vis i");
    });

    it("short-aliases should return alias for update", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "short-aliases")!;
        const msg = tip.message(makeContext("update"));

        expect(msg).toContain("vis up");
    });

    it("short-aliases should return alias for link", () => {
        expect.assertions(1);

        const tip = tips.find((t) => t.id === "short-aliases")!;
        const msg = tip.message(makeContext("link"));

        expect(msg).toContain("vis ln");
    });
});
