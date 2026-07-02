import { describe, expect, it } from "vitest";

import { detectAiSession, isAiSession } from "../src/session";

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
            variable: "CLAUDECODE",
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
            variable: "AI_AGENT",
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

        expect(ambient).toStrictEqual({ agent: "Cursor editor", confidence: "ambient", provider: "cursor", variable: "CURSOR_TRACE_ID" });
        // A definite marker shadows an ambient one even with ambient enabled.
        expect(detectAiSession({ CURSOR_AGENT: "1", CURSOR_TRACE_ID: "trace-1" }, { includeAmbient: true })?.confidence).toBe("definite");
    });
});
