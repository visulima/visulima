import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { VisConfig } from "../../../src/config/types";
import type { PolicyInput } from "../../../src/security/policies";
import { evaluateUnexpectedDepsPolicy } from "../../../src/security/policies/unexpected-deps";

const buildInput = (workspaceRoot: string): PolicyInput => {
    return {
        offline: false,
        packageManager: "pnpm",
        packages: [
            { isDev: false, name: "lodash", version: "4.17.21" },
            { isDev: false, name: "axios", version: "1.6.0" },
        ],
        workspaceRoot,
    };
};

describe(evaluateUnexpectedDepsPolicy, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-policy-unexpected-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("emits nothing when neither allow nor baselineLockfile is set", () => {
        expect.assertions(1);

        const config: VisConfig = { security: { policies: { unexpectedDeps: {} } } };

        expect(evaluateUnexpectedDepsPolicy(buildInput(workspaceRoot), config)).toStrictEqual([]);
    });

    it("blocks packages not present on the allow-list", () => {
        expect.assertions(3);

        const config: VisConfig = { security: { policies: { unexpectedDeps: { allow: ["lodash"] } } } };
        const decisions = evaluateUnexpectedDepsPolicy(buildInput(workspaceRoot), config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.packageName).toBe("axios");
        expect(decisions[0]?.severity).toBe("block");
    });

    it("supports glob patterns in the allow-list", () => {
        expect.assertions(1);

        const config: VisConfig = { security: { policies: { unexpectedDeps: { allow: ["lod*", "ax*"] } } } };

        expect(evaluateUnexpectedDepsPolicy(buildInput(workspaceRoot), config)).toStrictEqual([]);
    });

    it("flags packages missing from the baseline lockfile", () => {
        expect.assertions(2);

        // Baseline only references lodash@4.17.20 — current input has 4.17.21 and axios@1.6.0.
        // Both should be flagged because neither name@version pair appears in the baseline.
        const baselinePath = join(workspaceRoot, "baseline.pnpm-lock.yaml");

        writeFileSync(
            baselinePath,
            `lockfileVersion: '9.0'

packages:

  lodash@4.17.20:
    resolution: {integrity: sha512-x}
`,
        );

        const config: VisConfig = {
            security: { policies: { unexpectedDeps: { baselineLockfile: baselinePath } } },
        };
        const decisions = evaluateUnexpectedDepsPolicy(buildInput(workspaceRoot), config);

        expect(decisions).toHaveLength(2);
        expect(decisions.every((d) => d.severity === "block")).toBe(true);
    });

    it("silently ignores an unparseable baseline file (returns no decisions for baseline portion)", () => {
        expect.assertions(1);

        const baselinePath = join(workspaceRoot, "missing.yaml");
        const config: VisConfig = {
            security: { policies: { unexpectedDeps: { baselineLockfile: baselinePath } } },
        };
        // With only the baseline configured (no allow), unparseable file = no enforcement.
        const decisions = evaluateUnexpectedDepsPolicy(buildInput(workspaceRoot), config);

        expect(decisions).toStrictEqual([]);
    });
});
