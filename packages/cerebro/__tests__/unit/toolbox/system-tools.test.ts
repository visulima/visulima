import { describe, expect, it } from "vitest";

import systemTools from "../../../src/toolbox/system-tools";

describe("system-tools", () => {
    it("which - existing package", () => {
        const result = systemTools.which("node");
        expect(result).not.toBeNull();
    });

    it("which - non-existing package", () => {
        const result = systemTools.which("non-existing-package");
        expect(result).toBeNull();
    });

    it("execute - should reject if the addCommand does not exist", async () => {
        try {
            await systemTools.run('echo "hi" && non-existing-command');
        } catch (error) {
            expect(error.stdout).toContain("hi");

            if (process.platform === "win32") {
                expect(error.stderr).toContain("is not recognized as an internal or external addCommand");
            } else {
                expect(error.stderr).toContain("non-existing-command");
            }
        }
    });

    it("execute - should resolve if the addCommand exists", async () => {
        // `echo` should be a general addCommand for both *nix and windows
        await expect(systemTools.run("echo cerebro", { trim: true })).resolves.toBe("cerebro");
    });
});
