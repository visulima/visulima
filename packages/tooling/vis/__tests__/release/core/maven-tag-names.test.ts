import { describe, expect, it } from "vitest";

import { defaultTagFor, floatingMajorTagFor, renderTagPattern } from "../../../src/release/core/git";
import { compileReleaseTagRegex, releaseTagListGlob } from "../../../src/release/core/version-resolver";

/** Git refuses `:` in ref names, so a `groupId:artifactId` must tag as `groupId/artifactId`. */
describe("release tags for Maven coordinates", () => {
    it("tags a Maven module release as groupId/artifactId@version", () => {
        expect.hasAssertions();

        expect(defaultTagFor("io.visulima:vis-jvm", "1.1.0")).toBe("io.visulima/vis-jvm@1.1.0");
        expect(renderTagPattern("{name}@{version}", { name: "io.visulima:vis-jvm", version: "1.1.0" })).toBe("io.visulima/vis-jvm@1.1.0");
        expect(renderTagPattern("{unscopedName}-{version}", { name: "io.visulima:vis-jvm", version: "1.1.0" })).toBe("io.visulima/vis-jvm-1.1.0");
        expect(floatingMajorTagFor("io.visulima:vis-jvm", "1.1.0")).toBe("io.visulima-vis-jvm-v1");
    });

    it("finds the tag again when listing and matching releases", () => {
        expect.hasAssertions();

        const pkg = { name: "io.visulima:vis-jvm" };

        expect(releaseTagListGlob("{name}@{version}", pkg)).toBe("io.visulima/vis-jvm@*");
        expect(compileReleaseTagRegex("{name}@{version}", pkg).exec("io.visulima/vis-jvm@1.1.0")?.[1]).toBe("1.1.0");
    });

    it("leaves npm, Cargo and Python names unchanged", () => {
        expect.hasAssertions();

        expect(defaultTagFor("@acme/cli", "1.0.0")).toBe("@acme/cli@1.0.0");
        expect(defaultTagFor("my_crate", "0.2.0")).toBe("my_crate@0.2.0");
        expect(releaseTagListGlob("{name}@{version}", { name: "@acme/cli" })).toBe("@acme/cli@*");
    });
});
