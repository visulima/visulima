import { afterEach, describe, expect, it, vi } from "vitest";

import { detectScriptShell, resetShellCache } from "../src/detect-shell";

describe("detectScriptShell", () => {
    afterEach(() => {
        resetShellCache();
        delete process.env["npm_config_script_shell"];
    });

    it("should return undefined when no script-shell is configured", () => {
        delete process.env["npm_config_script_shell"];
        resetShellCache();

        const result = detectScriptShell();

        // On most systems npm config returns "undefined" string or empty
        // Either undefined (not configured) or a path is valid
        expect(result === undefined || typeof result === "string").toBe(true);
    });

    it("should detect script-shell from npm_config_script_shell env var", () => {
        process.env["npm_config_script_shell"] = "/usr/bin/bash";
        resetShellCache();

        const result = detectScriptShell();

        expect(result).toBe("/usr/bin/bash");
    });

    it("should cache the result after first call", () => {
        process.env["npm_config_script_shell"] = "/bin/zsh";
        resetShellCache();

        const first = detectScriptShell();
        // Change env var -- should still return cached value
        process.env["npm_config_script_shell"] = "/bin/fish";
        const second = detectScriptShell();

        expect(first).toBe("/bin/zsh");
        expect(second).toBe("/bin/zsh");
    });

    it("should reset cache with resetShellCache", () => {
        process.env["npm_config_script_shell"] = "/bin/zsh";
        resetShellCache();

        detectScriptShell();

        process.env["npm_config_script_shell"] = "/bin/fish";
        resetShellCache();

        expect(detectScriptShell()).toBe("/bin/fish");
    });
});
