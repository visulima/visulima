import { describe, expect, it } from "vitest";

import { toNpmPurl } from "../../src/sbom/purl";

describe(toNpmPurl, () => {
    it("should build a purl for an unscoped package", () => {
        expect.assertions(1);

        expect(toNpmPurl("lodash", "4.17.21")).toBe("pkg:npm/lodash@4.17.21");
    });

    it("should build a purl for a scoped package", () => {
        expect.assertions(1);

        expect(toNpmPurl("@visulima/vis", "1.0.0")).toBe("pkg:npm/%40visulima/vis@1.0.0");
    });

    it("should lowercase the package name per the PURL spec", () => {
        expect.assertions(1);

        expect(toNpmPurl("React", "18.2.0")).toBe("pkg:npm/react@18.2.0");
    });

    it("should percent-encode characters outside the unreserved set", () => {
        expect.assertions(1);

        expect(toNpmPurl("pkg name", "1.0.0+build.1")).toBe("pkg:npm/pkg%20name@1.0.0%2Bbuild.1");
    });
});
