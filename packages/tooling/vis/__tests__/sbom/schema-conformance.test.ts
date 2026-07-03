import { describe, expect, it } from "vitest";

import type { CycloneDxBom } from "../../src/sbom/types";
import { validateBom } from "./validator";

/**
 * Minimal BOM that exercises the fields `vis sbom` will actually emit:
 * root metadata, one workspace project as the root component, a single
 * external dependency with a licence + hash, and the dependency edge.
 */
const buildFixtureBom = (): CycloneDxBom => {
    return {
        // eslint-disable-next-line sonarjs/no-clear-text-protocols -- canonical CycloneDX schema $id, not a fetch target
        $schema: "http://cyclonedx.org/schema/bom-1.7.schema.json",
        bomFormat: "CycloneDX",
        components: [
            {
                "bom-ref": "pkg:npm/lodash@4.17.21",
                hashes: [
                    {
                        alg: "SHA-512",
                        content: "c".repeat(128),
                    },
                ],
                licenses: [{ license: { id: "MIT" } }],
                name: "lodash",
                purl: "pkg:npm/lodash@4.17.21",
                scope: "required",
                type: "library",
                version: "4.17.21",
            },
        ],
        dependencies: [
            {
                dependsOn: ["pkg:npm/lodash@4.17.21"],
                ref: "pkg:npm/my-app@1.0.0",
            },
            {
                ref: "pkg:npm/lodash@4.17.21",
            },
        ],
        metadata: {
            component: {
                "bom-ref": "pkg:npm/my-app@1.0.0",
                name: "my-app",
                purl: "pkg:npm/my-app@1.0.0",
                type: "application",
                version: "1.0.0",
            },
            timestamp: "2026-04-13T00:00:00Z",
            tools: {
                components: [
                    {
                        name: "@visulima/vis",
                        type: "application",
                        version: "1.0.0",
                    },
                ],
            },
        },
        serialNumber: "urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79",
        specVersion: "1.7",
        version: 1,
    };
};

describe("cycloneDX 1.7 schema conformance", () => {
    it("should accept a minimal BOM with a single component", () => {
        expect.assertions(1);

        const result = validateBom(buildFixtureBom());

        expect(result).toStrictEqual({ errors: [], valid: true });
    });

    it("should accept a BOM expressed as an SPDX licence expression", () => {
        expect.assertions(1);

        const bom: CycloneDxBom = buildFixtureBom();

        bom.components![0]!.licenses = [{ expression: "MIT OR Apache-2.0" }];

        expect(validateBom(bom).valid).toBe(true);
    });

    it("should reject a BOM missing bomFormat", () => {
        expect.assertions(2);

        const bom = buildFixtureBom();

        // @ts-expect-error -- deliberately invalidating the BOM
        delete bom.bomFormat;

        const result = validateBom(bom);

        expect(result.valid).toBe(false);
        expect(result.errors.some((error) => error.message.includes("bomFormat"))).toBe(true);
    });

    it("should reject a component with an unknown type", () => {
        expect.assertions(1);

        const bom = buildFixtureBom();

        // @ts-expect-error -- deliberately invalidating the BOM
        bom.components![0]!.type = "not-a-real-type";

        expect(validateBom(bom).valid).toBe(false);
    });

    it("should reject a dependency whose ref is missing", () => {
        expect.assertions(1);

        const bom = buildFixtureBom();

        // @ts-expect-error -- deliberately invalidating the BOM
        delete bom.dependencies![0]!.ref;

        expect(validateBom(bom).valid).toBe(false);
    });

    it("should accept a BOM with an empty component list", () => {
        expect.assertions(1);

        const bom: CycloneDxBom = {
            bomFormat: "CycloneDX",
            components: [],
            dependencies: [],
            metadata: { timestamp: "2026-04-13T00:00:00Z" },
            serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000000",
            specVersion: "1.7",
            version: 1,
        };

        expect(validateBom(bom).valid).toBe(true);
    });
});
