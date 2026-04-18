import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { scanString, transformYamlBlockScalars } from "../src/index";

/* eslint-disable vitest/prefer-expect-assertions -- expect.assertions lives past the nativeBinaryPresent guard so skipped runs don't fail the assertion-count check */

// End-to-end tests that exercise the Rust detector through the JS wrapper.
// Use a minimal inline config (one rule, `extendBundled: false`) so the
// ruleset compile stays fast — the full 1,058-rule compile is multi-second
// on first call and would blow the default vitest 5s timeout.

const here = dirname(fileURLToPath(import.meta.url));
const esmRequire = createRequire(import.meta.url);

let nativeBinaryPresent: boolean;

try {
    esmRequire(resolve(here, "..", "index.js"));
    nativeBinaryPresent = true;
} catch {
    nativeBinaryPresent = false;
}

const MINIMAL_CONFIG = {
    rules: [
        {
            description: "Fake token for tests",
            id: "test-token",
            keywords: ["TESTTOKEN"],
            regex: String.raw`TESTTOKEN_[A-Za-z0-9]{20}`,
            tags: ["test"],
        },
    ],
    title: "test",
};

describe("pragma suppression (end-to-end)", () => {
    it("same-line `pragma: allowlist secret` suppresses the finding", async () => {
        if (!nativeBinaryPresent) {
            return;
        }

        expect.assertions(2);

        const unsuppressed = await scanString("let x = TESTTOKEN_abcdefghij0123456789\n", "file.ts", {
            config: { extendBundled: false, inline: MINIMAL_CONFIG },
        });

        expect(unsuppressed).toHaveLength(1);

        const suppressed = await scanString("let x = TESTTOKEN_abcdefghij0123456789 // pragma: allowlist secret\n", "file.ts", {
            config: { extendBundled: false, inline: MINIMAL_CONFIG },
        });

        expect(suppressed).toHaveLength(0);
    }, 30_000);

    it("previous-line `pragma: allowlist nextline secret` suppresses the finding", async () => {
        if (!nativeBinaryPresent) {
            return;
        }

        expect.assertions(1);

        const content = ["# pragma: allowlist nextline secret", "let x = TESTTOKEN_abcdefghij0123456789", ""].join("\n");

        const findings = await scanString(content, "file.ts", {
            config: { extendBundled: false, inline: MINIMAL_CONFIG },
        });

        expect(findings).toHaveLength(0);
    }, 30_000);

    it("nextline pragma two lines up does NOT suppress (only immediate previous line counts)", async () => {
        if (!nativeBinaryPresent) {
            return;
        }

        expect.assertions(1);

        const content = ["# pragma: allowlist nextline secret", "unrelated line", "let x = TESTTOKEN_abcdefghij0123456789"].join("\n");

        const findings = await scanString(content, "file.ts", {
            config: { extendBundled: false, inline: MINIMAL_CONFIG },
        });

        expect(findings).toHaveLength(1);
    }, 30_000);
});

describe("yaml transformer × scanString integration", () => {
    it("detects a secret that was split across a block scalar after transform", async () => {
        if (!nativeBinaryPresent) {
            return;
        }

        expect.assertions(3);

        // Secret intentionally split across two block-scalar lines — without
        // the transformer, neither line contains the full match.
        const yamlSource = ["config:", "  token: |", "    TESTTOKEN_abcdefghij", "    0123456789extra", ""].join("\n");

        const raw = await scanString(yamlSource, "config.yaml", {
            config: { extendBundled: false, inline: MINIMAL_CONFIG },
        });

        expect(raw).toHaveLength(0);

        const transformed = transformYamlBlockScalars(yamlSource);
        const findings = await scanString(transformed, "config.yaml", {
            config: { extendBundled: false, inline: MINIMAL_CONFIG },
        });

        expect(findings).toHaveLength(1);
        // Line numbers preserved: the collapsed proxy sits on the original
        // `token: |` line (line 2).
        expect(findings[0]?.startLine).toBe(2);
    }, 30_000);
});
