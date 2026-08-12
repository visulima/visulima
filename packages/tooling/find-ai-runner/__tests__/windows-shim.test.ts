import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { planInvocation } from "../src/index";
import { parseShimTarget } from "../src/windows-shim";

/*
 * Real `cmd-shim` output. npm, pnpm and yarn all generate their `.cmd` shims with the same package,
 * so one layout covers all three; the trailing `"%_prog%" "%dp0%\..." %*` line is the part that
 * names the script the shim runs.
 */
const NPM_SHIM = String.raw`@ECHO off
GOTO start
:find_dp0
SET dp0=%~dp0
EXIT /b
:start
SETLOCAL
CALL :find_dp0

IF EXIST "%dp0%\node.exe" (
  SET "_prog=%dp0%\node.exe"
) ELSE (
  SET "_prog=node"
  SET PATHEXT=%PATHEXT:;.JS;=;%
)

endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\..\@anthropic-ai\claude-code\cli.js" %*
`;

const YARN_STYLE_SHIM = String.raw`@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\..\gemini-cli\dist\index.mjs" %*
) ELSE (
  node  "%~dp0\..\gemini-cli\dist\index.mjs" %*
)
`;

/** A shim wrapping a native binary — no JS target to find. */
const EXE_WRAPPER_SHIM = String.raw`@ECHO off
"%~dp0\codex.exe" %*
`;

describe(parseShimTarget, () => {
    it("resolves the JS entry point out of an npm cmd-shim", () => {
        expect.assertions(1);

        const binDirectory = String.raw`C:\Users\me\AppData\Roaming\npm`;
        const target = parseShimTarget(NPM_SHIM, String.raw`${binDirectory}\claude.cmd`);

        // `%dp0%\..\` walks out of the `npm` bin directory into its sibling package tree.
        expect(target).toBe(String.raw`C:\Users\me\AppData\Roaming` + String.raw`\@anthropic-ai\claude-code\cli.js`);
    });

    it("resolves a %~dp0-style shim and an .mjs target", () => {
        expect.assertions(1);

        const target = parseShimTarget(YARN_STYLE_SHIM, String.raw`C:\tools\bin\gemini.cmd`);

        expect(target).toBe(String.raw`C:\tools\gemini-cli\dist\index.mjs`);
    });

    it("returns undefined for a shim that wraps a native executable", () => {
        expect.assertions(1);

        expect(parseShimTarget(EXE_WRAPPER_SHIM, String.raw`C:\tools\bin\codex.cmd`)).toBeUndefined();
    });

    it("resolves against the shim's own directory, not the process cwd", () => {
        expect.assertions(2);

        const fromC = parseShimTarget(NPM_SHIM, String.raw`C:\a\bin\claude.cmd`);
        const fromD = parseShimTarget(NPM_SHIM, String.raw`D:\other\place\claude.cmd`);

        expect(fromC).toBe(String.raw`C:\a\@anthropic-ai\claude-code\cli.js`);
        expect(fromD).toBe(String.raw`D:\other\@anthropic-ai\claude-code\cli.js`);
    });
});

describe(planInvocation, () => {
    it("spawns a non-shim path directly on any platform", () => {
        expect.assertions(2);

        expect(planInvocation("/usr/local/bin/claude", false)).toStrictEqual({ file: "/usr/local/bin/claude", mode: "direct", prefixArguments: [] });
        expect(planInvocation(String.raw`C:\tools\claude.exe`, true)).toStrictEqual({
            file: String.raw`C:\tools\claude.exe`,
            mode: "direct",
            prefixArguments: [],
        });
    });

    it("never treats a .cmd path as a shim off Windows", () => {
        expect.assertions(1);

        // A Unix file that merely ends in .cmd must not be routed through the shim resolver.
        expect(planInvocation("/opt/weird/claude.cmd", false).mode).toBe("direct");
    });

    it("falls back to the shell for a Windows shim it cannot resolve", () => {
        expect.assertions(1);

        // No such file, so the resolver returns undefined. The shell fallback still carries the
        // `%VAR%` hole — this asserts the fallback exists, not that it is safe.
        expect(planInvocation(String.raw`C:\does\not\exist\claude.cmd`, true)).toStrictEqual({
            commandPath: String.raw`C:\does\not\exist\claude.cmd`,
            mode: "shell",
        });
    });

    // Windows-only: the resolver pins win32 path semantics (a `.cmd` shim is a Windows artefact),
    // so a POSIX temp path resolves to a win32-shaped path that does not exist on this host. The
    // parsing itself is covered platform-independently by the parseShimTarget suite above.
    it.runIf(process.platform === "win32")("resolves a real shim to an interpreter plus script, with no shell", async () => {
        expect.assertions(3);

        // Build an actual cmd-shim layout on disk so the resolver's IO path is exercised.
        const directory = await mkdtemp(join(tmpdir(), "find-ai-runner-shim-"));
        const target = join(directory, "cli.js");

        await writeFile(target, "#!/usr/bin/env node\n");
        await writeFile(join(directory, "claude.cmd"), `@ECHO off\r\n"%_prog%"  "%dp0%\\cli.js" %*\r\n`);

        const plan = planInvocation(join(directory, "claude.cmd"), true);

        expect(plan.mode).toBe("direct");
        // The prompt is handed over as argv, so cmd.exe never parses it and %VAR% is inert.
        expect(plan).toHaveProperty("prefixArguments", [target]);
        expect(plan).toHaveProperty("file", process.execPath);

        await rm(directory, { force: true, recursive: true });
    });
});
