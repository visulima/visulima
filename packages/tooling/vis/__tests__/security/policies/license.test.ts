import { describe, expect, it } from "vitest";

import type { VisConfig } from "../../../src/config/types";
import type { PackageManifest } from "../../../src/security/manifests";
import type { PolicyInput } from "../../../src/security/policies";
import { evaluateLicensePolicy } from "../../../src/security/policies/license";

const buildInput = (
    packages: { license?: PackageManifest["license"]; licenses?: PackageManifest["licenses"]; name: string; version: string }[],
): PolicyInput => {
    const manifestData = new Map<string, PackageManifest>();

    for (const p of packages) {
        manifestData.set(`${p.name}@${p.version}`, {
            directory: `/tmp/${p.name}`,
            license: p.license,
            licenses: p.licenses,
            name: p.name,
            version: p.version,
        });
    }

    return {
        manifestData,
        offline: false,
        packageManager: "pnpm",
        packages: packages.map((p) => { return { isDev: false, name: p.name, version: p.version }; }),
        workspaceRoot: "/tmp",
    };
};

describe(evaluateLicensePolicy, () => {
    it("returns no decisions when neither allow nor deny is set", () => {
        expect.assertions(1);

        const input = buildInput([{ license: "GPL-3.0", name: "evil", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: {} } } };

        expect(evaluateLicensePolicy(input, config)).toStrictEqual([]);
    });

    it("blocks packages that declare a denied license", () => {
        expect.assertions(2);

        const input = buildInput([{ license: "GPL-3.0", name: "evil", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { deny: ["GPL-3.0"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]).toMatchObject({
            packageName: "evil",
            policy: "license",
            severity: "block",
        });
    });

    it("blocks SPDX-expression packages when ANY sub-expression hits the deny list", () => {
        expect.assertions(2);

        // (MIT OR GPL-3.0): even though MIT is permitted, the resolver
        // *could* pick GPL-3.0 — that's enough to block.
        const input = buildInput([{ license: "(MIT OR GPL-3.0)", name: "dual", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { deny: ["GPL-3.0"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.data?.deniedLicense).toBe("GPL-3.0");
    });

    it("allows packages whose license matches the allow-list", () => {
        expect.assertions(1);

        const input = buildInput([{ license: "MIT", name: "fine", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { allow: ["MIT", "Apache-2.0"] } } } };

        expect(evaluateLicensePolicy(input, config)).toStrictEqual([]);
    });

    it("blocks packages whose license is not on the allow-list", () => {
        expect.assertions(2);

        const input = buildInput([{ license: "ISC", name: "stray", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { allow: ["MIT", "Apache-2.0"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.data?.unallowedLicense).toBe("ISC");
    });

    it("blocks packages with no declared license when allow-list is set", () => {
        expect.assertions(2);

        const input = buildInput([{ name: "no-license", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { allow: ["MIT"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.data?.declaredLicense).toBeNull();
    });

    it("accepts the legacy `licenses[]` array form", () => {
        expect.assertions(2);

        const input = buildInput([{ licenses: [{ type: "GPL-3.0" }], name: "legacy", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { deny: ["GPL-3.0"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.severity).toBe("block");
    });

    it("matches accepted-risk entries scoped to the license policy", () => {
        expect.assertions(2);

        const input = buildInput([{ license: "GPL-3.0", name: "approved", version: "1.0.0" }]);
        const config: VisConfig = {
            security: {
                acceptedRisks: {
                    approved: {
                        acceptedAt: "2026-01-01T00:00:00Z",
                        policies: ["license"],
                        reason: "internal exception",
                    },
                },
                policies: { license: { deny: ["GPL-3.0"] } },
            },
        };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.acceptedRisk).toBeDefined();
    });
});
