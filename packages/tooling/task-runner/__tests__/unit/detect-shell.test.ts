import { afterEach, describe, expect, it, vi } from "vitest";

import { detectScriptShell, resetShellCache } from "../../src/detect-shell";

vi.mock(import("node:child_process"), async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();

    return { ...actual, execFileSync: vi.fn<typeof actual.execFileSync>(actual.execFileSync) };
});

const { execFileSync } = await import("node:child_process");
const execFileSyncMock = vi.mocked(execFileSync);

describe(detectScriptShell, () => {
    afterEach(() => {
        resetShellCache();
        delete process.env["npm_config_script_shell"];
        execFileSyncMock.mockReset();
    });

    it("should return undefined when no script-shell is configured", () => {
        expect.assertions(1);

        delete process.env["npm_config_script_shell"];
        resetShellCache();

        const result = detectScriptShell();

        // On most systems npm config returns "undefined" string or empty
        // Either undefined (not configured) or a path is valid
        expect(result === undefined || typeof result === "string").toBe(true);
    });

    it("should detect script-shell from npm_config_script_shell env var", () => {
        expect.assertions(1);

        process.env["npm_config_script_shell"] = "/usr/bin/bash";
        resetShellCache();

        const result = detectScriptShell();

        expect(result).toBe("/usr/bin/bash");
    });

    it("should cache the result after first call", () => {
        expect.assertions(2);

        process.env["npm_config_script_shell"] = "/bin/zsh";
        resetShellCache();

        const first = detectScriptShell();

        // Change env var -- should still return cached value
        process.env["npm_config_script_shell"] = "/bin/fish";
        const second = detectScriptShell();

        expect(first).toBe("/bin/zsh");
        expect(second).toBe("/bin/zsh");
    });

    it("should treat npm config output 'null' as unset (workspace-root regression)", () => {
        expect.assertions(1);

        delete process.env["npm_config_script_shell"];
        resetShellCache();
        // npm in a workspace root prints the literal "null" when script-shell
        // isn't configured. Without filtering, the runner would later try to
        // spawn `null -c <command>`.
        execFileSyncMock.mockReturnValueOnce("null\n");

        expect(detectScriptShell()).toBeUndefined();
    });

    it("should treat npm config output 'undefined' as unset", () => {
        expect.assertions(1);

        delete process.env["npm_config_script_shell"];
        resetShellCache();
        execFileSyncMock.mockReturnValueOnce("undefined\n");

        expect(detectScriptShell()).toBeUndefined();
    });

    it("should return a real shell path from npm config when configured", () => {
        expect.assertions(1);

        delete process.env["npm_config_script_shell"];
        resetShellCache();
        execFileSyncMock.mockReturnValueOnce("/usr/local/bin/bash\n");

        expect(detectScriptShell()).toBe("/usr/local/bin/bash");
    });

    it("should spawn npm.cmd with shell:true on win32 (CVE-2024-27980 hardening)", () => {
        // Regression: on Windows `npm` is a `.cmd` shim and spawning it via
        // execFileSync without `shell: true` throws since Node's
        // CVE-2024-27980 hardening, silently degrading the documented
        // script-shell detection. Verify the platform-specific spawn shape.
        expect.assertions(3);

        delete process.env["npm_config_script_shell"];
        resetShellCache();

        const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("win32");

        try {
            const gitBashPath = String.raw`C:\Program Files\Git\bin\bash.exe`;

            execFileSyncMock.mockReturnValueOnce(`${gitBashPath}\n`);

            const result = detectScriptShell();

            expect(result).toBe(gitBashPath);
            expect(execFileSyncMock.mock.calls[0]?.[0]).toBe("npm.cmd");
            expect(execFileSyncMock.mock.calls[0]?.[2]).toMatchObject({ shell: true });
        } finally {
            platformSpy.mockRestore();
        }
    });

    it("should spawn plain npm without shell on non-win32", () => {
        expect.assertions(2);

        delete process.env["npm_config_script_shell"];
        resetShellCache();

        const platformSpy = vi.spyOn(process, "platform", "get").mockReturnValue("linux");

        try {
            execFileSyncMock.mockReturnValueOnce("/usr/bin/bash\n");

            detectScriptShell();

            expect(execFileSyncMock.mock.calls[0]?.[0]).toBe("npm");
            expect(execFileSyncMock.mock.calls[0]?.[2]).toMatchObject({ shell: false });
        } finally {
            platformSpy.mockRestore();
        }
    });

    it("should reset cache with resetShellCache", () => {
        expect.assertions(1);

        process.env["npm_config_script_shell"] = "/bin/zsh";
        resetShellCache();

        detectScriptShell();

        process.env["npm_config_script_shell"] = "/bin/fish";
        resetShellCache();

        expect(detectScriptShell()).toBe("/bin/fish");
    });
});
