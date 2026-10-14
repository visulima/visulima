import { describe, expect, it } from "vitest";

import { inheritedAssignments, maskGradleComments, ownAssignments, replaceGradleLiteral, scanGradleBuild, scanGradleSettings } from "../../src/util/gradle-build";

describe(maskGradleComments, () => {
    it("blanks comments but keeps offsets, newlines and strings", () => {
        expect.hasAssertions();

        const raw = "version = \"1.0\" // trailing\n/* block\n */ group = \"x\"\nurl = \"https://example.test\"";
        const masked = maskGradleComments(raw);

        expect(masked).toHaveLength(raw.length);
        expect(masked).not.toContain("trailing");
        expect(masked).not.toContain("block");
        expect(masked).toContain("version = \"1.0\"");
        expect(masked).toContain("https://example.test");
    });
});

describe(scanGradleBuild, () => {
    it("reads a Kotlin and a Groovy version literal at the top level", () => {
        expect.hasAssertions();

        const kotlin = scanGradleBuild("group = \"io.visulima\"\nversion = \"1.2.3\"\n");
        const groovy = scanGradleBuild("group 'io.visulima'\nversion '1.2.3'\n");

        expect(ownAssignments(kotlin.assignments, "version")[0]?.literal?.value).toBe("1.2.3");
        expect(ownAssignments(groovy.assignments, "version")[0]?.literal?.value).toBe("1.2.3");
        expect(ownAssignments(groovy.assignments, "group")[0]?.literal?.value).toBe("io.visulima");
    });

    it("rewrites the literal in place using the recorded offsets", () => {
        expect.hasAssertions();

        const raw = "plugins { id(\"x\") }\n// version = \"0.0.1\"\nversion = \"1.2.3\" // keep\n";
        const [declaration] = ownAssignments(scanGradleBuild(raw).assignments, "version");

        expect(replaceGradleLiteral(raw, declaration!.literal!, "2.0.0")).toBe("plugins { id(\"x\") }\n// version = \"0.0.1\"\nversion = \"2.0.0\" // keep\n");
    });

    it("finds allprojects and subprojects declarations, including one-line blocks", () => {
        expect.hasAssertions();

        const scan = scanGradleBuild(
            "allprojects {\n    group = \"io.visulima\"\n    version = \"3.0.0\"\n}\nsubprojects { version = \"4.0.0\" }\n",
        );

        expect(inheritedAssignments(scan.assignments, "version", false).map((a) => a.literal?.value)).toStrictEqual(["3.0.0", "4.0.0"]);
        expect(inheritedAssignments(scan.assignments, "version", true).map((a) => a.literal?.value)).toStrictEqual(["3.0.0"]);
        expect(inheritedAssignments(scan.assignments, "group", false)[0]?.literal?.value).toBe("io.visulima");
    });

    it("does not treat a top-level root version as inherited", () => {
        expect.hasAssertions();

        const scan = scanGradleBuild("version = \"1.0.0\"\n");

        expect(inheritedAssignments(scan.assignments, "version", false)).toHaveLength(0);
    });

    it("marks an expression as non-literal and keeps its line", () => {
        expect.hasAssertions();

        const [declaration] = ownAssignments(scanGradleBuild("\n\nversion = findProperty(\"v\")\n").assignments, "version");

        expect(declaration?.literal).toBeUndefined();
        expect(declaration?.line).toBe(3);
    });

    it("ignores a version string inside a comment or a URL that looks like one", () => {
        expect.hasAssertions();

        const scan = scanGradleBuild("// version = \"9.9.9\"\nurl = \"https://x.test/version = 8\"\nversion = \"1.0.0\"\n");

        expect(ownAssignments(scan.assignments, "version").map((a) => a.literal?.value)).toStrictEqual(["1.0.0"]);
    });

    it("collects project references and flags archive renames", () => {
        expect.hasAssertions();

        const scan = scanGradleBuild("dependencies { implementation(project(\":lib:core\")) }\nbase.archivesName = \"x\"\n");

        expect(scan.projectRefs).toStrictEqual([":lib:core"]);
        expect(scan.usesArchiveName).toBe(true);
    });
});

describe(scanGradleSettings, () => {
    it("reads include calls in Kotlin, Groovy and multi-line forms", () => {
        expect.hasAssertions();

        const scan = scanGradleSettings(
            "rootProject.name = \"root\"\ninclude(\":core\", \":lib:util\")\ninclude 'app'\ninclude(\n    \":web\",\n    \":api:v1\",\n)\n",
        );

        expect(scan.includes.toSorted()).toStrictEqual(["api/v1", "app", "core", "lib/util", "web"]);
        expect(scan.rootName).toBe("root");
        expect(scan.dynamicIncludes).toBe(false);
        expect(scan.unsupported).toStrictEqual([]);
    });

    it("does not read includeBuild as a module", () => {
        expect.hasAssertions();

        expect(scanGradleSettings("includeBuild(\"tools\")\ninclude(\":a\")\n").includes).toStrictEqual(["a"]);
    });

    it("flags a code-built include list and a moved project directory", () => {
        expect.hasAssertions();

        const dynamic = scanGradleSettings("File(rootDir, \"libs\").listFiles().each { include it.name }\n");
        const moved = scanGradleSettings("include(\":x\")\nproject(\":x\").projectDir = file(\"elsewhere\")\n");

        expect(dynamic.dynamicIncludes).toBe(true);
        expect(moved.unsupported).toStrictEqual(["projectDir"]);
    });
});
