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
        packages: packages.map((p) => {
            return { isDev: false, name: p.name, version: p.version };
        }),
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

    it("ignores SPDX `WITH` exception identifiers (right-hand side is a modifier, not a license)", () => {
        expect.assertions(1);

        // `Classpath-exception-2.0` is an SPDX exception identifier, not a
        // license. Allow-list mode against a `GPL-2.0 WITH …` expression
        // should pass when GPL-2.0 is allowed, even though the exception
        // identifier isn't on the allow-list.
        const input = buildInput([{ license: "GPL-2.0 WITH Classpath-exception-2.0", name: "jdk-pkg", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { allow: ["GPL-2.0"] } } } };

        expect(evaluateLicensePolicy(input, config)).toStrictEqual([]);
    });

    it("treats `<id>+` (or-later) as matching the canonical `-or-later` SPDX form on deny", () => {
        expect.assertions(1);

        const input = buildInput([{ license: "GPL-3.0+", name: "legacy-or-later", version: "1.0.0" }]);
        // The user wrote the canonical SPDX 3.x form in their deny list.
        const config: VisConfig = { security: { policies: { license: { deny: ["GPL-3.0-or-later"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
    });

    it("treats `LicenseRef-*` as a leaf that must be explicitly allow-listed", () => {
        expect.assertions(2);

        const input = buildInput([{ license: "LicenseRef-corporate-eula", name: "proprietary", version: "1.0.0" }]);
        const config: VisConfig = { security: { policies: { license: { allow: ["MIT"] } } } };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.data?.unallowedLicense).toBe("LicenseRef-corporate-eula");
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

    it("ignores expired accepted-risk entries (expiresAt in the past)", () => {
        expect.assertions(2);

        const input = buildInput([{ license: "GPL-3.0", name: "stale", version: "1.0.0" }]);
        const config: VisConfig = {
            security: {
                acceptedRisks: {
                    stale: {
                        acceptedAt: "2020-01-01T00:00:00Z",
                        expiresAt: "2020-12-31T00:00:00Z",
                        policies: ["license"],
                        reason: "lapsed exemption",
                    },
                },
                policies: { license: { deny: ["GPL-3.0"] } },
            },
        };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        // Expired entries don't apply — the decision is unmasked.
        expect(decisions[0]?.acceptedRisk).toBeUndefined();
    });

    it("does not apply accepted-risk entries scoped to other policies", () => {
        expect.assertions(2);

        const input = buildInput([{ license: "GPL-3.0", name: "score-only", version: "1.0.0" }]);
        const config: VisConfig = {
            security: {
                acceptedRisks: {
                    "score-only": {
                        acceptedAt: "2026-01-01T00:00:00Z",
                        policies: ["score"],
                        reason: "score-only exception",
                    },
                },
                policies: { license: { deny: ["GPL-3.0"] } },
            },
        };
        const decisions = evaluateLicensePolicy(input, config);

        expect(decisions).toHaveLength(1);
        expect(decisions[0]?.acceptedRisk).toBeUndefined();
    });
});
