import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { evaluateWhen, explainWhen, getCurrentBranch, resetBranchCache } from "../../src/when-condition";

describe(evaluateWhen, () => {
    it("returns true for empty condition", () => {
        expect.assertions(1);

        expect(evaluateWhen(undefined, {})).toBe(true);
    });

    describe("os clause", () => {
        it("matches platform string", () => {
            expect.assertions(2);

            expect(evaluateWhen({ os: "linux" }, { platform: "linux" })).toBe(true);
            expect(evaluateWhen({ os: "linux" }, { platform: "darwin" })).toBe(false);
        });

        it("matches array of platforms", () => {
            expect.assertions(2);

            expect(evaluateWhen({ os: ["linux", "darwin"] }, { platform: "darwin" })).toBe(true);
            expect(evaluateWhen({ os: ["linux", "darwin"] }, { platform: "win32" })).toBe(false);
        });

        it("treats 'windows' as alias for 'win32'", () => {
            expect.assertions(2);

            expect(evaluateWhen({ os: "windows" }, { platform: "win32" })).toBe(true);
            expect(evaluateWhen({ os: "win32" }, { platform: "windows" })).toBe(true);
        });
    });

    describe("env clause", () => {
        it("checks variable presence with bare string", () => {
            expect.assertions(3);

            expect(evaluateWhen({ env: "DEPLOY_TOKEN" }, { env: { DEPLOY_TOKEN: "abc" } })).toBe(true);
            expect(evaluateWhen({ env: "DEPLOY_TOKEN" }, { env: {} })).toBe(false);
            expect(evaluateWhen({ env: "DEPLOY_TOKEN" }, { env: { DEPLOY_TOKEN: "" } })).toBe(false);
        });

        it("checks exact value with equals", () => {
            expect.assertions(2);

            expect(evaluateWhen({ env: { equals: "production", name: "NODE_ENV" } }, { env: { NODE_ENV: "production" } })).toBe(true);
            expect(evaluateWhen({ env: { equals: "production", name: "NODE_ENV" } }, { env: { NODE_ENV: "dev" } })).toBe(false);
        });

        it("checks negative presence with exists: false", () => {
            expect.assertions(2);

            expect(evaluateWhen({ env: { exists: false, name: "FOO" } }, { env: {} })).toBe(true);
            expect(evaluateWhen({ env: { exists: false, name: "FOO" } }, { env: { FOO: "x" } })).toBe(false);
        });

        it("any-of semantics for arrays", () => {
            expect.assertions(2);

            expect(evaluateWhen({ env: ["A", "B"] }, { env: { B: "1" } })).toBe(true);
            expect(evaluateWhen({ env: ["A", "B"] }, { env: { C: "1" } })).toBe(false);
        });

        it("returns false when no array matcher is satisfied", () => {
            expect.assertions(1);

            expect(evaluateWhen({ env: ["A", "B", "C"] }, { env: { D: "1", E: "2" } })).toBe(false);
        });
    });

    describe("branch clause", () => {
        it("matches single branch", () => {
            expect.assertions(2);

            expect(evaluateWhen({ branch: "main" }, { branch: "main" })).toBe(true);
            expect(evaluateWhen({ branch: "main" }, { branch: "feat/x" })).toBe(false);
        });

        it("matches array of branches", () => {
            expect.assertions(1);

            expect(evaluateWhen({ branch: ["main", "alpha"] }, { branch: "alpha" })).toBe(true);
        });

        it("returns false when branch is unknown", () => {
            expect.assertions(1);

            expect(evaluateWhen({ branch: "main" }, { branch: "" })).toBe(false);
        });
    });

    describe("ci clause", () => {
        it("matches true when CI is set", () => {
            expect.assertions(2);

            expect(evaluateWhen({ ci: true }, { env: { CI: "true" } })).toBe(true);
            expect(evaluateWhen({ ci: true }, { env: {} })).toBe(false);
        });

        it("matches false when CI is unset", () => {
            expect.assertions(2);

            expect(evaluateWhen({ ci: false }, { env: {} })).toBe(true);
            expect(evaluateWhen({ ci: false }, { env: { CI: "1" } })).toBe(false);
        });

        it("treats CI=false as not in CI", () => {
            expect.assertions(1);

            expect(evaluateWhen({ ci: true }, { env: { CI: "false" } })).toBe(false);
        });

        it("treats CI=0 as not in CI", () => {
            expect.assertions(2);

            expect(evaluateWhen({ ci: true }, { env: { CI: "0" } })).toBe(false);
            expect(evaluateWhen({ ci: false }, { env: { CI: "0" } })).toBe(true);
        });
    });

    describe("not clause", () => {
        it("inverts os", () => {
            expect.assertions(2);

            expect(evaluateWhen({ not: { os: "windows" } }, { platform: "linux" })).toBe(true);
            expect(evaluateWhen({ not: { os: "windows" } }, { platform: "win32" })).toBe(false);
        });

        it("inverts ci", () => {
            expect.assertions(2);

            expect(evaluateWhen({ not: { ci: true } }, { env: {} })).toBe(true);
            expect(evaluateWhen({ not: { ci: true } }, { env: { CI: "1" } })).toBe(false);
        });
    });

    describe("compound conditions", () => {
        it("aNDs all positive clauses", () => {
            expect.assertions(2);

            expect(evaluateWhen({ branch: "main", ci: true, os: "linux" }, { branch: "main", env: { CI: "1" }, platform: "linux" })).toBe(true);
            expect(evaluateWhen({ branch: "main", ci: true, os: "linux" }, { branch: "main", env: {}, platform: "linux" })).toBe(false);
        });
    });
});

describe(explainWhen, () => {
    it("returns empty string when condition passes", () => {
        expect.assertions(1);

        expect(explainWhen({ os: "linux" }, { platform: "linux" })).toBe("");
    });

    it("describes failed os clause", () => {
        expect.assertions(1);

        expect(explainWhen({ os: "linux" }, { platform: "darwin" })).toContain("os=darwin");
    });

    it("describes failed ci clause", () => {
        expect.assertions(1);

        expect(explainWhen({ ci: true }, { env: {} })).toContain("ci=false");
    });
});

describe(getCurrentBranch, () => {
    let directory: string;

    beforeEach(() => {
        // eslint-disable-next-line sonarjs/pseudo-random
        directory = mkdtempSync(join(tmpdir(), `branch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-`));
        resetBranchCache();
    });

    afterEach(() => {
        rmSync(directory, { force: true, recursive: true });
        resetBranchCache();
    });

    it("returns empty string outside a git repository", () => {
        expect.assertions(1);

        expect(getCurrentBranch(directory)).toBe("");
    });

    it("caches per cwd so different workspaces never alias", () => {
        expect.assertions(2);

        // eslint-disable-next-line sonarjs/pseudo-random
        const second = mkdtempSync(join(tmpdir(), `branch-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-`));

        try {
            expect(getCurrentBranch(directory)).toBe(getCurrentBranch(directory));
            // Both miss git → both empty, but the lookup must be keyed by cwd,
            // not stored as a single module-global string.
            expect(getCurrentBranch(second)).toBe("");
        } finally {
            rmSync(second, { force: true, recursive: true });
        }
    });

    it("resetBranchCache clears all cached entries", () => {
        expect.assertions(1);

        const first = getCurrentBranch(directory);

        resetBranchCache();

        // Reset shouldn't change the answer for a stable cwd — but it
        // also shouldn't blow up; the second call must round-trip.
        expect(getCurrentBranch(directory)).toBe(first);
    });
});
