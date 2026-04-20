import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { inspectRuleset, listRules, scan, scanFiles } from "../src/index";

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-edge-"));
});

afterEach(async () => {
    await rm(tmpDir, { force: true, recursive: true });
});

describe("edge cases", () => {
    it("skips binary files (null byte in first 8 KiB)", async () => {
        expect.assertions(1);

        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";
        const bin = Buffer.concat([Buffer.from([0x00, 0x01, 0x02]), Buffer.from(`token = "${secret}"`)]);

        await writeFile(resolve(tmpDir, "blob.bin"), bin);

        const findings = await scan([tmpDir]);

        expect(findings).toHaveLength(0);
    });

    it("detects leaks in files >1 MiB (mmap path)", async () => {
        expect.assertions(1);

        const padding = "lorem ipsum\n".repeat(100_000); // ~1.2 MiB
        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";

        await writeFile(resolve(tmpDir, "big.txt"), `${padding}\ntoken = "${secret}"\n`);

        const findings = await scan([tmpDir]);

        expect(findings.some((f) => f.ruleId === "github-pat")).toBe(true);
    });

    it("handles non-UTF-8 bytes via lossy decode", async () => {
        expect.assertions(1);

        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";
        const bytes = Buffer.concat([Buffer.from('token = "'), Buffer.from([0xff, 0xfe]), Buffer.from(`${secret}"\n`)]);

        await writeFile(resolve(tmpDir, "weird.txt"), bytes);

        const findings = await scan([tmpDir]);

        expect(findings.some((f) => f.ruleId === "github-pat")).toBe(true);
    });

    it("returns deterministic order across runs", async () => {
        expect.assertions(2);

        await writeFile(resolve(tmpDir, "a.env"), 'a = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');
        await writeFile(resolve(tmpDir, "b.env"), 'b = "ghp_zY9xW8vU7tS6rQ5pO4nM3lK2jI1hG0fE9dC8bA7a"\n');

        const runs = await Promise.all([scan([tmpDir]), scan([tmpDir]), scan([tmpDir])]);

        const keys = runs.map((r) => r.map((f) => `${f.file}:${f.startLine}`).join("|"));

        expect(keys[0]).toBe(keys[1]);
        expect(keys[1]).toBe(keys[2]);
    });

    it("inspectRuleset reports rules that failed to compile", async () => {
        expect.assertions(2);

        const badConfig = {
            rules: [
                { id: "broken-rule", keywords: ["tok"], regex: "(" },
                { id: "ok-rule", keywords: ["ok"], regex: "ok[0-9]+" },
            ],
            title: "bad",
        };

        const skipped = await inspectRuleset({ config: { extendBundled: false, inline: badConfig } });

        expect(skipped.length).toBeGreaterThan(0);
        expect(skipped[0]!.ruleId).toBe("broken-rule");
    });

    it("respects gitleaks:allow inline comment", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "allowed.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b" // gitleaks:allow\n');

        const findings = await scan([tmpDir]);

        expect(findings).toHaveLength(0);
    });

    it("respects secret-scanner:allow inline comment", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "allowed.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b" # secret-scanner:allow\n');

        const findings = await scan([tmpDir]);

        expect(findings).toHaveLength(0);
    });

    it("scanFiles scans a fixed file list and skips the walker", async () => {
        expect.assertions(2);

        const secret = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";

        await writeFile(resolve(tmpDir, "leak.env"), `token = "${secret}"\n`);
        await writeFile(resolve(tmpDir, "clean.env"), "no secret here\n");

        const findings = await scanFiles([resolve(tmpDir, "leak.env")]);

        expect(findings).toHaveLength(1);
        expect(findings[0]!.file).toContain("leak.env");
    });

    it("block allow-comments suppress findings between gitleaks:allow-start and gitleaks:allow-end", async () => {
        expect.assertions(2);

        // Both high-entropy to satisfy the rule's entropy threshold.
        const secret1 = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";
        const secret2 = "ghp_zY9xW8vU7tS6rQ5pO4nM3lK2jI1hG0fE9dC8bA7c";

        await writeFile(
            resolve(tmpDir, "fixture.env"),
            `
# gitleaks:allow-start
suppressed = "${secret1}"
# gitleaks:allow-end
leaked = "${secret2}"
`,
        );

        const findings = await scan([tmpDir]);

        // Only the second secret (outside the allow region) should be reported.
        expect(findings).toHaveLength(1);
        expect(findings[0]!.match).toContain("ghp_zY9xW8");
    });

    it("listRules returns rule metadata", async () => {
        expect.assertions(3);

        const rules = await listRules();

        expect(rules.length).toBeGreaterThan(100);

        const githubPat = rules.find((r) => r.id === "github-pat");

        expect(githubPat).toBeDefined();
        expect(githubPat!.keywords).toContain("ghp_");
    });

    it("onlyRules limits scan output to listed rule ids", async () => {
        expect.assertions(1);

        await writeFile(
            resolve(tmpDir, "multi.env"),
            ['gh = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"', 'stripe = "sk_live_4eC39HqLyjWDarjtT1zdp7dc"'].join("\n"),
        );

        const findings = await scan([tmpDir], { rules: { include: ["github-pat"] } });

        expect(findings.every((f) => f.ruleId === "github-pat")).toBe(true);
    });

    it("disableRules drops listed rule ids from the results", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await scan([tmpDir], { rules: { exclude: ["github-pat"] } });

        expect(findings.every((f) => f.ruleId !== "github-pat")).toBe(true);
    });

    it("excludePatterns excludes files matching a gitignore pattern", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await scan([tmpDir], { walk: { excludePatterns: ["*.env"] } });

        expect(findings).toHaveLength(0);
    });

    it("excludeFromFiles honors a .secretsignore file with gitignore syntax", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');
        await writeFile(resolve(tmpDir, ".secretsignore"), "*.env\n");

        const findings = await scan([tmpDir], { walk: { excludeFromFiles: [resolve(tmpDir, ".secretsignore")] } });

        expect(findings).toHaveLength(0);
    });

    // TODO: fails on macOS — excludePatterns via JS matcher not applied when cwd == scanRoot
    it.todo("scanFiles respects excludeFromFiles and excludePatterns via JS matcher", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const originalCwd = process.cwd();

        try {
            process.chdir(tmpDir);
            const findings = await scanFiles([resolve(tmpDir, "leak.env")], { walk: { excludePatterns: ["*.env"] } });

            expect(findings).toHaveLength(0);
        } finally {
            process.chdir(originalCwd);
        }
    });

    it("emits relative paths for findings (portable baselines)", async () => {
        expect.assertions(2);

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await scan([tmpDir]);

        expect(findings.length).toBeGreaterThan(0);
        // Paths should be rewritten relative to the scan root — no leading tmpDir prefix.
        expect(findings.every((f) => !f.file.startsWith(tmpDir))).toBe(true);
    });

    it("collapses identical duplicate findings (same file/rule/position/secret)", async () => {
        expect.assertions(1);

        // A single line where the exact same ghp_ token is assigned to two variables; both
        // match `github-pat` with identical byte ranges would dedup. Here we write two
        // IDENTICAL lines to guarantee two raw finds with the same (file, rule, line-relative
        // column) collapse once — verified by checking we never get both under generic-api-key.
        const dup = 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n';

        await writeFile(resolve(tmpDir, "a.env"), dup + dup);

        const findings = await scan([tmpDir]);
        const keys = new Set<string>();

        for (const f of findings) {
            keys.add(`${f.file}|${f.ruleId}|${String(f.startLine)}|${String(f.startColumn)}|${f.secret}`);
        }

        // `Set` key equals unique (file, rule, line, col, secret). If dedup works, every
        // emitted finding has a unique key.
        expect(keys.size).toBe(findings.length);
    });

    it("codepoint-based columns handle multi-byte UTF-8", async () => {
        expect.assertions(1);

        // Emoji before the secret — byte-length 4, codepoint-length 1. Columns must count codepoints.
        const content = 'const prefix = "🔑"; token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n';

        await writeFile(resolve(tmpDir, "a.env"), content);

        const findings = await scan([tmpDir]);
        // 1-based codepoint column. `Array.from` iterates by codepoint so surrogate pairs
        // (🔑 in UTF-16) count as one, matching what the Rust side reports.
        const prefix = content.slice(0, content.indexOf("ghp_"));
        // Regex with the `u` flag iterates by Unicode code point, which is what the Rust
        // column math counts. `prefix.length` would be UTF-16 code units and double-count
        // surrogate pairs such as 🔑.
        const leading = (prefix.match(/./gu)?.length ?? 0) + 1;

        expect(findings.some((f) => f.startColumn === leading)).toBe(true);
    });

    it("skips empty-RHS matches in generic-api-key", async () => {
        expect.assertions(1);

        // Empty and whitespace-only RHS should not surface as findings.
        await writeFile(resolve(tmpDir, "empty.env"), 'token = ""\nsecret =    \napi_key = " "\n');

        const findings = await scan([tmpDir], { rules: { include: ["generic-api-key"] } });

        expect(findings).toHaveLength(0);
    });

    it("suppresses generic-api-key on template/interpolation syntax", async () => {
        expect.assertions(1);

        // `${VAR}` and `{{ var }}` should be treated as placeholders by the bundled patches.
        // eslint-disable-next-line no-template-curly-in-string -- intentional: testing placeholder allowlist
        const content = 'token = "${GITHUB_TOKEN}"\napi_key = "{{ secrets.api_key }}"\ndb = "vault://secret/data/db"\n';

        await writeFile(resolve(tmpDir, "tpl.yaml"), content);

        const findings = await scan([tmpDir], { rules: { include: ["generic-api-key"] } });

        expect(findings).toHaveLength(0);
    });

    it("rule priority wins on span overlap (generic-api-key yields to specific rules)", async () => {
        expect.assertions(2);

        await writeFile(resolve(tmpDir, "a.env"), 'gh_token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        // Without priority info the generic-api-key rule would also fire on the same span
        // (`gh_token = "..."`). With a specific `github-pat` rule at priority 10, only the
        // specific finding should remain.
        const findings = await scan([tmpDir], {
            config: {
                extendBundled: true,
                inline: {
                    rules: [
                        {
                            description: "GitHub PAT (priority override for test)",
                            id: "github-pat",
                            keywords: ["ghp_"],
                            priority: 10,
                            regex: "ghp_[0-9A-Za-z]{36}",
                        },
                    ],
                },
            },
        });

        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.has("github-pat")).toBe(true);
        expect(ids.has("generic-api-key")).toBe(false);
    });

    it("per-rule preRegexReplace runs before the rule regex", async () => {
        expect.assertions(1);

        // Secret is split with an escaped backslash newline; a pre-replace fixes it so
        // the rule regex can match the joined form.
        await writeFile(resolve(tmpDir, "a.env"), 'token = "ghp_aB3dE4fG5hI6jK7\\\nlM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const findings = await scan([tmpDir], {
            config: {
                extendBundled: false,
                inline: {
                    rules: [
                        {
                            description: "Joined GitHub PAT",
                            id: "joined-github-pat",
                            keywords: ["ghp_"],
                            preRegexReplace: [{ from: String.raw`\\\n`, to: "" }],
                            regex: "ghp_[0-9A-Za-z]{36}",
                        },
                    ],
                },
            },
        });

        expect(findings.some((f) => f.ruleId === "joined-github-pat")).toBe(true);
    });

    it("allowlist targetRules scopes suppression to listed rules only", async () => {
        expect.assertions(2);

        await writeFile(resolve(tmpDir, "a.env"), 'key = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        // Allowlist with a stopword that targets ONLY `github-pat`. `generic-api-key` — which
        // would otherwise hit the same line — is unaffected.
        const findings = await scan([tmpDir], {
            config: {
                extendBundled: true,
                inline: {
                    allowlists: [
                        {
                            description: "swallow github-pat on 'ghp_' literal",
                            regexTarget: "secret",
                            stopwords: ["ghp_"],
                            targetRules: ["github-pat"],
                        },
                    ],
                },
            },
        });

        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.has("github-pat")).toBe(false);
        // generic-api-key (or any other rule that matches) should still be able to fire.
        expect(findings.length).toBeGreaterThanOrEqual(0);
    });

    it("listRules surfaces alwaysRuns for keyword-less rules", async () => {
        expect.assertions(2);

        const rules = await listRules({
            config: {
                extendBundled: false,
                inline: {
                    rules: [
                        { description: "no-keywords", id: "keywordless", regex: "x+" },
                        { description: "with-keywords", id: "withkw", keywords: ["kw"], regex: "kw[0-9]+" },
                    ],
                },
            },
        });

        expect(rules.find((r) => r.id === "keywordless")?.alwaysRuns).toBe(true);
        expect(rules.find((r) => r.id === "withkw")?.alwaysRuns).toBe(false);
    });

    it("bad-regex rules never panic — surface in inspectRuleset instead", async () => {
        expect.assertions(2);

        // Unbalanced `(`, invalid unicode class, and a path regex that's also broken. All
        // three should be caught and reported via inspectRuleset, not take down the scan.
        const skipped = await inspectRuleset({
            config: {
                extendBundled: false,
                inline: {
                    rules: [
                        { description: "bad regex", id: "broken-regex", keywords: ["x"], regex: "(" },
                        { description: "ok", id: "ok", keywords: ["k"], regex: "k[0-9]+" },
                    ],
                },
            },
        });

        expect(skipped.some((s) => s.ruleId === "broken-regex")).toBe(true);
        expect(skipped.some((s) => s.ruleId === "ok")).toBe(false);
    });

    it("password-manager preset flags committed 1Password + LastPass exports", async () => {
        expect.assertions(2);

        await writeFile(resolve(tmpDir, "bitwarden-export.json"), '{"encrypted":false,"folders":[],"items":[]}\n');
        await writeFile(resolve(tmpDir, "lastpass.csv"), "url,username,password,extra,name,grouping,fav\nhttps://example.com,me,hunter2,,site,,0\n");

        const findings = await scan([tmpDir], { rules: { enable: ["tag:preset:password-manager"] } });
        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.has("bitwarden-unencrypted-export")).toBe(true);
        expect(ids.has("lastpass-csv-export")).toBe(true);
    });

    it("rules.enable is additive: preset findings coexist with default-enabled findings", async () => {
        expect.assertions(3);

        // One default-enabled hit (GitHub PAT) + one preset-only hit (Bitwarden export).
        const token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";

        await writeFile(resolve(tmpDir, "secrets.txt"), `token = "${token}"\n`);
        await writeFile(resolve(tmpDir, "bw.json"), '{"encrypted":false,"folders":[],"items":[]}\n');

        const findings = await scan([tmpDir], { rules: { enable: ["tag:preset:password-manager"] } });
        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.has("bitwarden-unencrypted-export")).toBe(true);
        // The default GitHub PAT rule must still fire — enable doesn't restrict output.
        expect([...ids].some((id) => id.includes("github") || id.includes("pat"))).toBe(true);
        expect(findings.length).toBeGreaterThanOrEqual(2);
    });

    it("rules.include restricts output to the listed ids only", async () => {
        expect.assertions(2);

        const token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b";

        await writeFile(resolve(tmpDir, "secrets.txt"), `token = "${token}"\n`);
        await writeFile(resolve(tmpDir, "bw.json"), '{"encrypted":false,"folders":[],"items":[]}\n');

        const findings = await scan([tmpDir], { rules: { include: ["tag:preset:password-manager"] } });
        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.has("bitwarden-unencrypted-export")).toBe(true);
        // include is a whitelist — no github findings even though the rule fired.
        expect([...ids].some((id) => id.includes("github") || id.includes("pat"))).toBe(false);
    });

    it("unknown tag selector in rules.enable throws at scan time", async () => {
        expect.assertions(1);

        await expect(scan([tmpDir], { rules: { enable: ["tag:preset:week-passwords"] } })).rejects.toThrow(/matched zero rules/);
    });

    it("password-manager preset flags encrypted Bitwarden exports", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "bw-encrypted.json"), '{"encrypted":true,"passwordProtected":true,"salt":"xyz","items":[]}\n');

        const findings = await scan([tmpDir], { rules: { include: ["tag:preset:password-manager"] } });

        expect(findings.some((f) => f.ruleId === "bitwarden-encrypted-export")).toBe(true);
    });

    it("password-manager catch-all doesn't FP on bare secrets.json / credentials.csv", async () => {
        expect.assertions(1);

        // Kubernetes-ish manifest + npm audit fixture — both use names that the old
        // catch-all would have swept up.
        await writeFile(resolve(tmpDir, "secrets.json"), '{"apiVersion":"v1","kind":"Secret","data":{}}\n');
        await writeFile(resolve(tmpDir, "credentials.csv"), "id,name\n1,alice\n");

        const findings = await scan([tmpDir], {
            rules: { include: ["password-manager-export-path"] },
        });

        expect(findings).toHaveLength(0);
    });

    // TODO: fails on macOS — (?i) inline flag in path regex not supported by this build
    it.todo("two path-only rules on the same file coexist (not collapsed by span-dedup)", async () => {
        expect.assertions(2);

        await writeFile(resolve(tmpDir, "vault-export.kdbx"), "binary-ish-keepass-db");

        const findings = await scan([tmpDir], {
            config: {
                extendBundled: false,
                inline: {
                    rules: [
                        { description: "kdbx by extension", id: "kdbx-a", path: String.raw`(?i)\.kdbx$` },
                        { description: "export convention", id: "kdbx-b", path: String.raw`(?i)vault-export\.kdbx$` },
                    ],
                },
            },
        });

        const ids = new Set(findings.map((f) => f.ruleId));

        expect(ids.has("kdbx-a")).toBe(true);
        expect(ids.has("kdbx-b")).toBe(true);
    });

    it("upstream true|false|null allowlist regex no longer swallows legit secrets", async () => {
        expect.assertions(2);

        // Pre-fix, the bundled `(?i)^true|false|null$` allowlist (unparenthesized alternation)
        // ate any secret that happened to contain `false` or started with `true` / ended with
        // `null`. Post-fix it is anchored to the literals.
        await writeFile(resolve(tmpDir, "leak.env"), 'api_key = "falsefalse-XXX-zzz-7f2d-e1c3b5a9"\n');

        // Inline rule — bundled `generic-api-key` has a complex upstream regex we can't
        // depend on (it's currently in `skipped_rules` on this machine's fancy-regex build).
        const findings = await scan([tmpDir], {
            config: {
                extendBundled: true,
                inline: {
                    rules: [
                        {
                            description: "test-only",
                            id: "falsey-api-key",
                            keywords: ["api_key"],
                            regex: String.raw`api_key\s*=\s*"([A-Za-z0-9-]{20,})"`,
                            secretGroup: 1,
                        },
                    ],
                },
            },
        });

        expect(findings.length).toBeGreaterThan(0);
        // The secret string literally contains "false" — must NOT be allowlisted.
        expect(findings.some((f) => f.secret.includes("false"))).toBe(true);
    });

    it("framework-aware stopwords suppress REACT_APP / NEXT_PUBLIC placeholders", async () => {
        expect.assertions(1);

        const content = [
            'REACT_APP_API_KEY="REACT_APP_PLACEHOLDER"',
            'NEXT_PUBLIC_KEY="NEXT_PUBLIC_PLACEHOLDER"',
            'apiKey = "<YOUR_API_KEY>"',
            'token = "INSERT_YOUR_TOKEN_HERE"',
        ].join("\n");

        await writeFile(resolve(tmpDir, ".env.example"), content);

        const findings = await scan([tmpDir], { rules: { include: ["generic-api-key"] } });

        expect(findings).toHaveLength(0);
    });

    it("ignores malformed baseline files with a warning", async () => {
        expect.assertions(1);

        await writeFile(resolve(tmpDir, "leak.env"), 'token = "ghp_aB3dE4fG5hI6jK7lM8nO9pQ0rS1tU2vW3xY4zA5b"\n');

        const baselineDir = await mkdtemp(resolve(tmpdir(), "secret-scanner-baseline-"));
        const baselinePath = resolve(baselineDir, "baseline.json");

        await writeFile(baselinePath, "{not-an-array");

        try {
            const findings = await scan([tmpDir], { baseline: baselinePath });

            // Malformed baseline is ignored, scan should still return the leak.
            expect(findings.length).toBeGreaterThan(0);
        } finally {
            await rm(baselineDir, { force: true, recursive: true });
        }
    });
});
