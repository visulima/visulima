import { describe, expect, it } from "vitest";

import { cleanPackageJsonForPublish } from "../../../src/release/core/clean-package-json";

describe(cleanPackageJsonForPublish, () => {
    const fullManifest = {
        dependencies: { lodash: "^4.0.0" },
        description: "A package",
        devDependencies: { vitest: "^2.0.0" },
        engines: { node: ">=22" },
        "lint-staged": { "*.ts": "eslint" },
        name: "@scope/pkg",
        nx: { tags: ["lib"] },
        publishConfig: { access: "public" },
        scripts: { build: "tsc" },
        version: "1.0.0",
        "vis-release": { managed: true },
    };

    it("strips default fields when cfg is true", () => {
        expect.hasAssertions();

        const result = cleanPackageJsonForPublish(fullManifest, true);

        expect(result.scripts).toBeUndefined();
        expect(result.devDependencies).toBeUndefined();
        expect(result.nx).toBeUndefined();
        expect(result["vis-release"]).toBeUndefined();
        expect(result["lint-staged"]).toBeUndefined();
    });

    it("strips defaults when cfg is undefined", () => {
        expect.hasAssertions();

        const result = cleanPackageJsonForPublish(fullManifest);

        expect(result.scripts).toBeUndefined();
        expect(result.devDependencies).toBeUndefined();
    });

    it("preserves runtime-relevant fields", () => {
        expect.hasAssertions();

        const result = cleanPackageJsonForPublish(fullManifest);

        expect(result.name).toBe("@scope/pkg");
        expect(result.version).toBe("1.0.0");
        expect(result.description).toBe("A package");
        expect(result.dependencies).toStrictEqual({ lodash: "^4.0.0" });
        expect(result.engines).toStrictEqual({ node: ">=22" });
        expect(result.publishConfig).toStrictEqual({ access: "public" });
    });

    it("ships unmodified when cfg is false", () => {
        expect.hasAssertions();

        const result = cleanPackageJsonForPublish(fullManifest, false);

        expect(result.scripts).toStrictEqual({ build: "tsc" });
        expect(result.devDependencies).toStrictEqual({ vitest: "^2.0.0" });
        expect(result.nx).toStrictEqual({ tags: ["lib"] });
    });

    it("extends defaults via cfg.strip", () => {
        expect.hasAssertions();

        const result = cleanPackageJsonForPublish(fullManifest, { strip: ["description"] });

        expect(result.description).toBeUndefined();
        expect(result.scripts).toBeUndefined();
    });

    it("preserves a default-stripped field when added to cfg.keep", () => {
        expect.hasAssertions();

        const result = cleanPackageJsonForPublish(fullManifest, { keep: ["scripts"] });

        expect(result.scripts).toStrictEqual({ build: "tsc" });
        expect(result.devDependencies).toBeUndefined();
    });

    it("does not mutate input", () => {
        expect.hasAssertions();

        const original = JSON.stringify(fullManifest);

        cleanPackageJsonForPublish(fullManifest, true);

        expect(JSON.stringify(fullManifest)).toBe(original);
    });
});
