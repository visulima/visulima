import { describe, expect, it } from "vitest";

import { fingerprint, legacyFingerprint } from "../src/fingerprint";
import type { Finding } from "../src/types";

const baseFinding = (overrides: Partial<Finding> = {}): Finding => {
    return {
        alternateMatches: [],
        confidence: "low",
        description: "",
        endColumn: 1,
        endLine: 1,
        entropy: 0,
        file: "src/app.ts",
        match: "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b",
        ruleId: "github-pat",
        secret: "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b",
        startColumn: 1,
        startLine: 1,
        tags: [],
        ...overrides,
    };
};

describe(fingerprint, () => {
    it("returns 16 lowercase hex characters", () => {
        expect.assertions(1);

        expect(fingerprint(baseFinding())).toMatch(/^[0-9a-f]{16}$/);
    });

    it("is stable across line shifts", () => {
        expect.assertions(1);

        const a = fingerprint(baseFinding({ startLine: 1 }));
        const b = fingerprint(baseFinding({ startLine: 400 }));

        expect(a).toBe(b);
    });

    it("changes when the secret changes", () => {
        expect.assertions(1);

        const a = fingerprint(baseFinding({ secret: "token-a" }));
        const b = fingerprint(baseFinding({ secret: "token-b" }));

        expect(a).not.toBe(b);
    });

    it("changes when the rule id changes", () => {
        expect.assertions(1);

        const a = fingerprint(baseFinding({ ruleId: "github-pat" }));
        const b = fingerprint(baseFinding({ ruleId: "aws-access-token" }));

        expect(a).not.toBe(b);
    });

    it("changes when the file path changes", () => {
        expect.assertions(1);

        const a = fingerprint(baseFinding({ file: "src/a.ts" }));
        const b = fingerprint(baseFinding({ file: "src/b.ts" }));

        expect(a).not.toBe(b);
    });

    it("hashes multibyte-UTF-8 secrets without throwing", () => {
        expect.assertions(1);

        const hash = fingerprint(baseFinding({ secret: "pässwörd-🔑-ünïcödé" }));

        expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
});

describe(legacyFingerprint, () => {
    it("formats as `<file>:<ruleId>:<startLine>`", () => {
        expect.assertions(1);

        const finding = baseFinding({ file: "config.env", ruleId: "aws-access-token", startLine: 42 });

        expect(legacyFingerprint(finding)).toBe("config.env:aws-access-token:42");
    });

    it("changes on any of file, ruleId, or startLine", () => {
        expect.assertions(3);

        const reference = legacyFingerprint(baseFinding({ file: "a", ruleId: "r", startLine: 1 }));

        expect(legacyFingerprint(baseFinding({ file: "b", ruleId: "r", startLine: 1 }))).not.toBe(reference);
        expect(legacyFingerprint(baseFinding({ file: "a", ruleId: "s", startLine: 1 }))).not.toBe(reference);
        expect(legacyFingerprint(baseFinding({ file: "a", ruleId: "r", startLine: 2 }))).not.toBe(reference);
    });

    it("is independent of the secret (line-based fingerprinting ignores content)", () => {
        expect.assertions(1);

        const a = legacyFingerprint(baseFinding({ secret: "one" }));
        const b = legacyFingerprint(baseFinding({ secret: "two" }));

        expect(a).toBe(b);
    });
});
