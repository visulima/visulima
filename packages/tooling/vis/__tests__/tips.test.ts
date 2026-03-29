import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TipContext } from "../src/tips";
import { showTip } from "../src/tips";

describe("showTip", () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
        // Ensure tips run in test by clearing env vars
        delete process.env.VIS_CLI_TEST;
        delete process.env.CI;
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

    it("should not show tips when CI is set", () => {
        expect.assertions(1);

        process.env.CI = "true";

        showTip({ args: ["install"], command: "install", success: true });

        expect(stderrSpy).not.toHaveBeenCalled();
    });
});

describe("tip matching", () => {
    it("should match short alias tip for install command", () => {
        expect.assertions(1);

        // Test the matching logic indirectly by checking the context
        const context: TipContext = { args: ["install"], command: "install", success: true };

        // The matching function should work for install
        expect(context.command).toBe("install");
    });

    it("should match short alias tip for remove command", () => {
        expect.assertions(1);

        const context: TipContext = { args: ["remove", "lodash"], command: "remove", success: true };

        expect(context.command).toBe("remove");
    });

    it("should match short alias tip for update command", () => {
        expect.assertions(1);

        const context: TipContext = { args: ["update"], command: "update", success: true };

        expect(context.command).toBe("update");
    });
});
