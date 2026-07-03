import { describe, expect, it } from "vitest";

import { detectAiSession, detectAiSessionAsync, detectAiSessionByProcess, isAiSession, isAiSessionAsync } from "../src/session";

describe(detectAiSession, () => {
    it("returns undefined for a plain human environment", () => {
        expect.assertions(2);

        expect(detectAiSession({ HOME: "/home/dev", TERM: "xterm-256color" })).toBeUndefined();
        expect(isAiSession({ HOME: "/home/dev" })).toBe(false);
    });

    it("detects definite harness markers and maps them to providers", () => {
        expect.assertions(4);

        expect(detectAiSession({ CLAUDECODE: "1" })).toStrictEqual({
            agent: "Claude Code",
            confidence: "definite",
            provider: "claude",
            signal: "CLAUDECODE",
            type: "agent",
        });
        expect(detectAiSession({ CURSOR_AGENT: "1" })?.provider).toBe("cursor");
        expect(detectAiSession({ CODEX_THREAD_ID: "abc123" })?.provider).toBe("codex");
        expect(detectAiSession({ COPILOT_ALLOW_ALL: "true" })?.provider).toBe("copilot");
    });

    it("detects agents that are not invokable providers without a provider mapping", () => {
        expect.assertions(2);

        const cline = detectAiSession({ CLINE_ACTIVE: "true" });

        expect(cline?.agent).toBe("Cline");
        expect(cline?.provider).toBeUndefined();
    });

    it("matches value-scoped markers only on the exact value", () => {
        expect.assertions(3);

        expect(detectAiSession({ AGENT: "amp" })?.agent).toBe("Amp");
        // A generic AGENT variable with another value must not read as Amp.
        expect(detectAiSession({ AGENT: "buildkite" })).toBeUndefined();
        expect(detectAiSession({ OR_APP_NAME: "Aider" })?.agent).toBe("Aider");
    });

    it("honors the self-describing AI_AGENT variable first", () => {
        expect.assertions(2);

        expect(detectAiSession({ AI_AGENT: "github-copilot-cli", CLAUDECODE: "1" })).toStrictEqual({
            agent: "github-copilot-cli",
            confidence: "definite",
            signal: "AI_AGENT",
            type: "agent",
        });
        // A disabled AI_AGENT falls through to the marker table.
        expect(detectAiSession({ AI_AGENT: "0", CLAUDECODE: "1" })?.agent).toBe("Claude Code");
    });

    it("ignores empty and explicitly-disabled marker values", () => {
        expect.assertions(2);

        expect(detectAiSession({ CLAUDECODE: "" })).toBeUndefined();
        expect(detectAiSession({ CLAUDECODE: "false" })).toBeUndefined();
    });

    it("reports ambient platform markers only when opted in", () => {
        expect.assertions(3);

        // A Cursor editor terminal hosts a human — not an agent session by default.
        expect(detectAiSession({ CURSOR_TRACE_ID: "trace-1" })).toBeUndefined();

        const ambient = detectAiSession({ CURSOR_TRACE_ID: "trace-1" }, { includeAmbient: true });

        expect(ambient).toStrictEqual({ agent: "Cursor editor", confidence: "ambient", provider: "cursor", signal: "CURSOR_TRACE_ID", type: "interactive" });
        // A definite marker shadows an ambient one even with ambient enabled.
        expect(detectAiSession({ CURSOR_AGENT: "1", CURSOR_TRACE_ID: "trace-1" }, { includeAmbient: true })?.confidence).toBe("definite");
    });

    it("detects the newly-added single-variable agents", () => {
        expect.assertions(5);

        expect(detectAiSession({ CODEIUM_EDITOR_APP_ROOT: "/opt/windsurf" })?.agent).toBe("Windsurf");
        expect(detectAiSession({ OZ_RUN_ID: "run-42" })?.agent).toBe("Warp");
        expect(detectAiSession({ PI_CODING_AGENT: "true" })?.agent).toBe("Pi");
        expect(detectAiSession({ CRUSH: "1" })?.provider).toBe("crush");
        expect(detectAiSession({ AGENT: "crush" })?.agent).toBe("Crush");
    });

    it("attributes Qwen Code to qwen even though it also sets GEMINI_CLI", () => {
        expect.assertions(2);

        // Qwen is a gemini-cli fork: its specific marker must win over the shared one.
        expect(detectAiSession({ GEMINI_CLI: "1", QWEN_CODE: "1" })?.provider).toBe("qwen");
        expect(detectAiSession({ GEMINI_CLI: "1" })?.provider).toBe("gemini");
    });

    it("matches composite all/any/none conditions", () => {
        expect.assertions(6);

        // Jules: HOME + USER together.
        expect(detectAiSession({ HOME: "/home/jules", USER: "swebot" })?.agent).toBe("Jules");
        expect(detectAiSession({ HOME: "/home/jules", USER: "dev" })).toBeUndefined();

        // Zed agent (definite) vs Zed editor (ambient), split on PAGER=cat.
        expect(detectAiSession({ PAGER: "cat", TERM_PROGRAM: "zed" })?.agent).toBe("Zed");
        expect(detectAiSession({ TERM_PROGRAM: "zed" })).toBeUndefined();
        expect(detectAiSession({ TERM_PROGRAM: "zed" }, { includeAmbient: true })).toStrictEqual({
            agent: "Zed editor",
            confidence: "ambient",
            provider: undefined,
            signal: "TERM_PROGRAM",
            type: "interactive",
        });

        // Antigravity: any of two variables.
        expect(detectAiSession({ ANTIGRAVITY_PROJECT_ID: "p1" })?.agent).toBe("Antigravity");
    });

    it("distinguishes Replit Assistant (agent) from a Replit workspace (ambient)", () => {
        expect.assertions(3);

        expect(detectAiSession({ REPL_ID: "r1", REPLIT_MODE: "assistant" })?.agent).toBe("Replit Assistant");
        // A bare workspace is ambient — a human is at the keyboard.
        expect(detectAiSession({ REPL_ID: "r1" })).toBeUndefined();
        expect(detectAiSession({ REPL_ID: "r1" }, { includeAmbient: true })?.agent).toBe("Replit workspace");
    });

    it("detects Copilot in VS Code but not a Cursor terminal with GIT_PAGER set", () => {
        expect.assertions(3);

        const copilot = detectAiSession({ GIT_PAGER: "cat", TERM_PROGRAM: "vscode" });

        expect(copilot?.agent).toBe("GitHub Copilot in VS Code");
        expect(copilot?.provider).toBe("copilot");
        // Cursor is a VS Code fork (TERM_PROGRAM=vscode); its CURSOR_TRACE_ID must NOT read as Copilot.
        expect(detectAiSession({ CURSOR_TRACE_ID: "t", GIT_PAGER: "cat", TERM_PROGRAM: "vscode" })?.agent).not.toBe("GitHub Copilot in VS Code");
    });

    it("reports the agent/interactive session type", () => {
        expect.assertions(3);

        expect(detectAiSession({ CLAUDECODE: "1" })?.type).toBe("agent");
        expect(detectAiSession({ CURSOR_TRACE_ID: "t" }, { includeAmbient: true })?.type).toBe("interactive");
        expect(detectAiSession({ npm_config_yes: "1", SHELL: "/bin/jsh" })?.type).toBe("agent");
    });
});

describe(detectAiSessionByProcess, () => {
    it("detects env-less agents by process ancestry", () => {
        expect.assertions(3);

        expect(detectAiSessionByProcess(["node", "octofriend", "zsh"])?.agent).toBe("Octofriend");
        expect(detectAiSessionByProcess(["node", "droid"])).toStrictEqual({
            agent: "Factory Droid",
            confidence: "definite",
            provider: "droid",
            signal: "process:droid",
            type: "agent",
        });
        expect(detectAiSessionByProcess(["node", "zsh", "login"])).toBeUndefined();
    });
});

describe(detectAiSessionAsync, () => {
    it("prefers env markers over process ancestry", async () => {
        expect.assertions(2);

        await expect(detectAiSessionAsync({ CLAUDECODE: "1" }, { ancestry: ["devin"], checkProcesses: true })).resolves.toMatchObject({ provider: "claude" });
        // With no env marker, an injected ancestry drives detection without spawning.
        await expect(detectAiSessionAsync({}, { ancestry: ["node", "devin"], checkProcesses: true })).resolves.toMatchObject({ agent: "Devin" });
    });

    it("does not consult the process tree unless checkProcesses is set", async () => {
        expect.assertions(2);

        await expect(detectAiSessionAsync({}, { ancestry: ["octofriend"] })).resolves.toBeUndefined();
        await expect(isAiSessionAsync({}, { ancestry: ["octofriend"], checkProcesses: true })).resolves.toBe(true);
    });
});
