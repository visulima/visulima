import { describe, expect, it } from "vitest";

import {
    assertValidPackageName,
    escapeMarkdown,
    interpolateCommand,
    isCustomCommandAllowed,
    isValidPackageName,
    redactTokens,
    resolveCustomCommands,
    sq,
} from "../../../src/release/core/security";

describe("sq: POSIX shell escape", () => {
    it("wraps simple strings in single quotes", () => {
        expect(sq("hello")).toBe("'hello'");
    });

    it("escapes embedded single quotes", () => {
        expect(sq("it's fine")).toBe(String.raw`'it'\''s fine'`);
    });

    it("renders shell metacharacters inert", () => {
        // Inside single quotes, $(...) is literal — not expanded.
        expect(sq("$(rm -rf /)")).toBe("'$(rm -rf /)'");
    });

    it("handles empty string", () => {
        expect(sq("")).toBe("''");
    });

    it("handles string with multiple single quotes", () => {
        expect(sq("a'b'c")).toBe(String.raw`'a'\''b'\''c'`);
    });
});

describe("isCustomCommandAllowed: trust gate", () => {
    it("returns false by default", () => {
        expect(isCustomCommandAllowed("@scope/a", {})).toBe(false);
        expect(isCustomCommandAllowed("@scope/a", { allowCustomCommands: false })).toBe(false);
    });

    it("returns true when allowCustomCommands is true", () => {
        expect(isCustomCommandAllowed("@scope/a", { allowCustomCommands: true })).toBe(true);
    });

    it("returns true when array includes literal name", () => {
        expect(isCustomCommandAllowed("@scope/a", { allowCustomCommands: ["@scope/a"] })).toBe(true);
    });

    it("returns true when array glob matches", () => {
        expect(isCustomCommandAllowed("@scope/foo", { allowCustomCommands: ["@scope/*"] })).toBe(true);
    });

    it("returns false when array doesn't include or match", () => {
        expect(isCustomCommandAllowed("@other/a", { allowCustomCommands: ["@scope/*"] })).toBe(false);
    });
});

describe("interpolateCommand: token substitution", () => {
    // Pin isWindows=false: these assert the POSIX (sq) quoting branch. Without
    // it, the default reads process.platform and produces cmd-style double
    // quotes on a Windows host, which is the platform-correct behaviour but not
    // what this block exercises.
    it("substitutes {{name}} and {{version}} via sq()", () => {
        expect(interpolateCommand("publish-bin {{name}} {{version}}", { name: "@scope/a", version: "1.0.0" }, false)).toBe("publish-bin '@scope/a' '1.0.0'");
    });

    it("escapes injected single quotes inside tokens", () => {
        expect(interpolateCommand("echo {{name}}", { name: "evil'name", version: "1.0.0" }, false)).toBe(String.raw`echo 'evil'\''name'`);
    });

    it("renders shell metacharacters inert in substituted tokens", () => {
        expect(interpolateCommand("echo {{version}}", { name: "x", version: "$(touch /tmp/pwn)" }, false)).toBe("echo '$(touch /tmp/pwn)'");
    });
});

describe("resolveCustomCommands: trust-gated", () => {
    const perPkg = { buildCommand: "y", checkPublished: "z", publishCommand: "x" };

    it("returns empty when gate denies", () => {
        const result = resolveCustomCommands("@scope/a", perPkg, {});

        expect(result).toStrictEqual({});
    });

    it("returns commands when gate allows", () => {
        const result = resolveCustomCommands("@scope/a", perPkg, { allowCustomCommands: true });

        expect(result.publishCommand).toBe("x");
        expect(result.buildCommand).toBe("y");
        expect(result.checkPublished).toBe("z");
    });

    it("respects glob allowlist", () => {
        expect(resolveCustomCommands("@scope/a", perPkg, { allowCustomCommands: ["@scope/*"] }).publishCommand).toBe("x");
        expect(resolveCustomCommands("@other/a", perPkg, { allowCustomCommands: ["@scope/*"] }).publishCommand).toBeUndefined();
    });
});

describe(redactTokens, () => {
    it("redacts npm token pattern", () => {
        expect(redactTokens("Authorization: npm_AbCd1234567890abcdef1234567890abcd")).toBe("Authorization: [REDACTED]");
    });

    it("redacts GH PAT (ghp_)", () => {
        // Split-literal so secretlint doesn't trip on the test fixture.
        const fakePat = `ghp_AbCd1234567890abcdef1234567890abcdef`;

        expect(redactTokens(`Bearer ${fakePat}`)).toBe("Bearer [REDACTED]");
    });

    it("redacts Bearer prefix", () => {
        expect(redactTokens("Authorization: Bearer some-long-opaque-token-here")).toBe("Authorization: [REDACTED]");
    });

    it("redacts ACTIONS_ID_TOKEN_REQUEST_TOKEN env var", () => {
        expect(redactTokens("env: ACTIONS_ID_TOKEN_REQUEST_TOKEN=abc123")).toBe("env: [REDACTED]");
    });

    it("redacts _authToken in npmrc", () => {
        expect(redactTokens("//registry/:_authToken=abc123def456")).toBe("//registry/:[REDACTED]");
    });

    it("leaves non-token content alone", () => {
        const text = "Just a regular log line with no secrets.";

        expect(redactTokens(text)).toBe(text);
    });

    it("handles multiple tokens in one line", () => {
        // Split-literal so secretlint doesn't trip on the test fixture.
        const fakeNpm = `npm_AbCd1234567890abcdef1234567890abcd`;
        const fakePat = `ghp_AbCd1234567890abcdef1234567890abcdef`;
        const out = redactTokens(`${fakeNpm} ${fakePat}`);

        expect(out.startsWith("[REDACTED] [REDACTED]")).toBe(true);
    });
});

describe("isValidPackageName / assertValidPackageName (RFC §19.4)", () => {
    it("accepts plain lowercase names", () => {
        expect(isValidPackageName("my-pkg")).toBe(true);
        expect(isValidPackageName("foo.bar")).toBe(true);
        expect(isValidPackageName("foo_bar")).toBe(true);
    });

    it("accepts scoped names", () => {
        expect(isValidPackageName("@scope/pkg")).toBe(true);
        expect(isValidPackageName("@my-org/sub.pkg_name")).toBe(true);
    });

    it("rejects shell metacharacters", () => {
        expect(isValidPackageName("evil$(rm -rf /)")).toBe(false);
        expect(isValidPackageName("a;b")).toBe(false);
        expect(isValidPackageName("a b")).toBe(false);
        expect(isValidPackageName("a&&b")).toBe(false);
        expect(isValidPackageName("a`b")).toBe(false);
    });

    it("rejects uppercase letters (npm spec)", () => {
        expect(isValidPackageName("MyPkg")).toBe(false);
    });

    it("rejects names starting with . or _", () => {
        expect(isValidPackageName(".hidden")).toBe(false);
        expect(isValidPackageName("_private")).toBe(false);
    });

    it("rejects empty / oversized names", () => {
        expect(isValidPackageName("")).toBe(false);
        expect(isValidPackageName("a".repeat(215))).toBe(false);
    });

    it("assertValidPackageName throws VisReleaseError on invalid input", () => {
        expect(() => {
            assertValidPackageName("evil;bad");
        }).toThrow(/Invalid package name/);
    });
});

describe("escapeMarkdown: PR-comment safety", () => {
    it("escapes < and >", () => {
        expect(escapeMarkdown("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
    });

    it("escapes &", () => {
        expect(escapeMarkdown("a & b")).toBe("a &amp; b");
    });

    it("escapes backticks", () => {
        expect(escapeMarkdown("rm -rf `pwd`")).toBe("rm -rf \\`pwd\\`");
    });

    it("preserves Markdown-relevant chars (* _ # -)", () => {
        // These are intentional Markdown that users want preserved.
        expect(escapeMarkdown("**bold** _italic_ # heading - bullet")).toBe("**bold** _italic_ # heading - bullet");
    });

    it("handles empty string", () => {
        expect(escapeMarkdown("")).toBe("");
    });
});
