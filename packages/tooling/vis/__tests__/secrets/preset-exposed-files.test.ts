import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { scanFiles } from "@visulima/secret-scanner";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const PEM_BODY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZWQy
NTUxOQAAACBfaketestkeydonotuseanywhereeverforanypurposeOK==
-----END OPENSSH PRIVATE KEY-----
`;

interface Fixture {
    /** Body for the file (use empty string for path-only rules). */
    content: string;
    /** When true, scanning the file should produce a finding for `ruleId`. */
    expectFinding: boolean;
    /** Relative path under tmpDir. */
    path: string;
    /** Rule we expect to (or not to) fire. */
    ruleId: string;
}

const fixtures: Fixture[] = [
    // path-only VCS rules
    { content: "[core]\n\trepositoryformatversion = 0\n", expectFinding: true, path: ".git/config", ruleId: "exposed-git-directory" },
    { content: "12\n", expectFinding: true, path: ".svn/format", ruleId: "exposed-svn-directory" },

    // env files
    { content: "DATABASE_URL=postgres://app:hunter2@db/app\n", expectFinding: true, path: ".env", ruleId: "exposed-env-file" },
    { content: "API_KEY=production-secret\n", expectFinding: true, path: ".env.production", ruleId: "exposed-env-file" },
    { content: "API_KEY=changeme\n", expectFinding: false, path: ".env.example", ruleId: "exposed-env-file" },
    { content: "API_KEY=changeme\n", expectFinding: false, path: ".env.sample", ruleId: "exposed-env-file" },

    // cloud creds
    {
        content: "[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
        expectFinding: true,
        path: ".aws/credentials",
        ruleId: "exposed-aws-credentials-file",
    },
    {
        content: "machine api.heroku.com\n  login me@example.com\n  password verysecrettoken\n",
        expectFinding: true,
        path: ".netrc",
        ruleId: "exposed-netrc-credentials",
    },
    {
        content: "{}",
        expectFinding: true,
        path: ".azure/accessTokens.json",
        ruleId: "exposed-azure-credentials",
    },

    // SSH/PEM keys
    { content: PEM_BODY, expectFinding: true, path: "id_rsa", ruleId: "exposed-private-key-named-file" },
    { content: PEM_BODY, expectFinding: true, path: "deploy_ed25519", ruleId: "exposed-private-key-named-file" },
    // .pub counterpart must NOT trip the named-file rule (path doesn't end on _rsa).
    { content: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO comment\n", expectFinding: false, path: "id_rsa.pub", ruleId: "exposed-private-key-named-file" },
    { content: PEM_BODY, expectFinding: true, path: "tls/server.pem", ruleId: "exposed-pem-private-key-file" },

    // database dumps
    {
        content: "-- MySQL dump 10.13  Distrib 8.0\nINSERT INTO `users` VALUES (1,'alice','hash');\n",
        expectFinding: true,
        path: "dump.sql",
        ruleId: "exposed-mysql-dump",
    },
    // Migration scripts with the same content are intentional — must be allowlisted.
    {
        content: "INSERT INTO `users` VALUES (1,'alice','hash');\n",
        expectFinding: false,
        path: "db/migrations/001_init.sql",
        ruleId: "exposed-mysql-dump",
    },
    {
        content: "INSERT INTO `users` VALUES (1,'alice','hash');\n",
        expectFinding: false,
        path: "prisma/migrations/20260101_init.sql",
        ruleId: "exposed-mysql-dump",
    },

    // backup files
    { content: "old config\n", expectFinding: true, path: "config.bak", ruleId: "exposed-backup-file-suffix" },
    { content: "tmp\n", expectFinding: true, path: "src/main.go.orig", ruleId: "exposed-backup-file-suffix" },
    // Public-asset backup convention is intentional.
    { content: "old\n", expectFinding: false, path: "public/index.html.bak", ruleId: "exposed-backup-file-suffix" },

    // editor / OS metadata
    { content: "tmp\n", expectFinding: true, path: "notes.txt~", ruleId: "exposed-tilde-backup" },
    { content: "binary placeholder", expectFinding: true, path: ".DS_Store", ruleId: "exposed-ds-store" },
    { content: "binary placeholder", expectFinding: true, path: "Thumbs.db", ruleId: "exposed-thumbs-db" },

    // build hygiene
    { content: "{\"name\":\"app\"}\n", expectFinding: true, path: "dist/package-lock.json", ruleId: "exposed-lockfile-in-build-output" },
    { content: "0", expectFinding: true, path: "dist/main.tsbuildinfo", ruleId: "exposed-tsconfig-buildinfo" },
    {
        content: "{\"version\":3,\"sources\":[\"src/index.ts\"],\"sourcesContent\":[\"export const x = 1;\"],\"mappings\":\"\"}\n",
        expectFinding: true,
        path: "dist/index.js.map",
        ruleId: "exposed-source-map-with-sources",
    },
    // Map without sourcesContent is not a leak — must NOT fire.
    {
        content: "{\"version\":3,\"sources\":[\"src/index.ts\"],\"mappings\":\"\"}\n",
        expectFinding: false,
        path: "dist/clean.js.map",
        ruleId: "exposed-source-map-with-sources",
    },
    { content: "ok", expectFinding: true, path: "dist/__tests__/foo.test.js", ruleId: "exposed-tests-in-build-output" },

    // logs
    { content: "0 verbose ...\n", expectFinding: true, path: "npm-debug.log", ruleId: "exposed-npm-debug-log" },

    // apache auth
    { content: "alice:$apr1$abc$def\n", expectFinding: true, path: ".htpasswd", ruleId: "exposed-htpasswd" },

    // jetbrains workspace
    { content: "<?xml version=\"1.0\"?><project></project>\n", expectFinding: true, path: ".idea/workspace.xml", ruleId: "exposed-jetbrains-workspace" },
];

describe("exposed-files preset", () => {
    let tmpDir: string;

    // First scan compiles the bundled ruleset (~1k regexes). Warm up both the
    // preset-filtered set (used by the positive test) and the default set (used
    // by the negative test) so neither pays the cold-compile cost — that cost
    // alone tips past the per-test timeout on slow CI runners.
    beforeAll(async () => {
        await scanFiles([], { rules: { enable: ["tag:preset:exposed-files"] } });
        await scanFiles([]);
    }, 120_000);

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-secrets-exposed-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    const writeFixture = (fixture: Fixture): string => {
        const absolute = join(tmpDir, fixture.path);
        const dir = absolute.split("/").slice(0, -1).join("/");

        mkdirSync(dir, { recursive: true });
        writeFileSync(absolute, fixture.content);

        return absolute;
    };

    // 30s timeout: scanning the full fixture set runs ~2s locally but the CI
    // runner has been observed >15s under parallel Nx load.
    it("flags every planted exposure and respects allowlists", { timeout: 30_000 }, async () => {
        // 1 assertion per fixture.
        // eslint-disable-next-line vitest/prefer-expect-assertions -- count is derived from fixtures.length
        expect.assertions(fixtures.length);

        const files = fixtures.map((fixture) => writeFixture(fixture));

        const findings = await scanFiles(files, {
            rules: { enable: ["tag:preset:exposed-files"] },
            walk: { gitignore: false, includeHidden: true },
        });

        // Group by-file for assertions — multiple rules may fire on a single
        // file (e.g. `id_rsa` triggers both the preset rule and the default
        // gitleaks `private-key` rule). We only care that the preset rule is
        // present (or absent for negative cases).
        const ruleIdsByPath = new Map<string, Set<string>>();

        for (const finding of findings) {
            for (const fixture of fixtures) {
                if (finding.file.endsWith(fixture.path)) {
                    if (!ruleIdsByPath.has(fixture.path)) {
                        ruleIdsByPath.set(fixture.path, new Set());
                    }

                    ruleIdsByPath.get(fixture.path)!.add(finding.ruleId);
                    break;
                }
            }
        }

        for (const fixture of fixtures) {
            const ids = ruleIdsByPath.get(fixture.path) ?? new Set<string>();
            const fired = ids.has(fixture.ruleId);

            expect(fired, `${fixture.path}: expected ${fixture.ruleId} to ${fixture.expectFinding ? "fire" : "be allowlisted"}`).toBe(fixture.expectFinding);
        }
    });

    it("emits no exposed-* findings when the preset is not enabled", { timeout: 30_000 }, async () => {
        expect.assertions(1);

        const files = fixtures.filter((fixture) => fixture.expectFinding).map((fixture) => writeFixture(fixture));

        const findings = await scanFiles(files, {
            walk: { gitignore: false, includeHidden: true },
        });

        const exposedHits = findings.filter((finding) => finding.ruleId.startsWith("exposed-"));

        expect(exposedHits).toStrictEqual([]);
    });
});
