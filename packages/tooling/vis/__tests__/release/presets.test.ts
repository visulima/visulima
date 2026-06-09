import { describe, expect, it } from "vitest";

import { cargo, goMod, gradleProperties, pomXml, pyproject } from "../../src/release/presets";

/**
 * Multi-language preset helpers. Each preset returns a
 * PerPackageReleaseConfig with one or more extra-files rules that
 * substitute the new version into the language's manifest file.
 *
 * We exercise the rule shape here; the actual regex substitution is
 * tested in extra-files.test.ts.
 */

describe("presets: cargo", () => {
    it("emits a Cargo.toml rule under the package root by default", () => {
        const config = cargo();

        expect(config.extraFiles).toHaveLength(1);
        expect(config.extraFiles?.[0]).toMatchObject({
            flags: "m",
            path: "Cargo.toml",
        });
    });

    it("places Cargo.toml under crateDir when provided", () => {
        const config = cargo({ crateDir: "crates/native" });

        expect(config.extraFiles?.[0]?.path).toBe("crates/native/Cargo.toml");
    });

    it("appends user-provided extra rules after the preset's own", () => {
        const config = cargo({
            extraFiles: [{ path: "README.md", search: String.raw`v\d+\.\d+\.\d+` }],
        });

        expect(config.extraFiles).toHaveLength(2);
        expect(config.extraFiles?.[1]?.path).toBe("README.md");
    });

    it("regex matches a typical Cargo.toml [package] version line", () => {
        const rule = cargo().extraFiles![0]!;
        const regex = new RegExp(rule.search, rule.flags);

        const cargoToml = "[package]\nname = \"foo\"\nversion = \"0.1.2\"\n\n[dependencies]\nserde = \"1.0\"\n";

        expect(regex.test(cargoToml)).toBe(true);

        const next = cargoToml.replace(regex, rule.replace!.replace("{version}", "1.0.0"));

        expect(next).toContain("version = \"1.0.0\"");
        // dep version stays at "1.0" — we only matched the [package] line.
        expect(next).toContain("serde = \"1.0\"");
    });
});

describe("presets: pyproject", () => {
    it("emits a pyproject.toml rule under the package root by default", () => {
        const config = pyproject();

        expect(config.extraFiles?.[0]?.path).toBe("pyproject.toml");
    });

    it("places pyproject.toml under projectDir when provided", () => {
        const config = pyproject({ projectDir: "py/sdk" });

        expect(config.extraFiles?.[0]?.path).toBe("py/sdk/pyproject.toml");
    });

    it("regex matches a PEP 621 [project] version line", () => {
        const rule = pyproject().extraFiles![0]!;
        const regex = new RegExp(rule.search, rule.flags);

        const toml = "[project]\nname = \"foo\"\nversion = \"0.1.2\"\ndependencies = []\n";

        expect(regex.test(toml)).toBe(true);
    });

    it("threads uvLockPath through when set (release-please #2561)", () => {
        // The preset doesn't mutate uv.lock itself — uv regenerates it
        // on `uv sync`/`uv build`. The path is recorded so doctor can
        // warn when it's missing despite the operator opting in.
        const config = pyproject({ uvLockPath: "../uv.lock" });

        expect(config.uvLockPath).toBe("../uv.lock");
        // The extra-files rule should still target pyproject.toml; uv.lock
        // is NOT in the rule set.
        expect(config.extraFiles?.some((r) => r.path === "../uv.lock")).toBe(false);
    });

    it("threads uvWorkspace through when set (release-please #2560)", () => {
        const config = pyproject({ uvWorkspace: { root: ".." } });

        expect(config.uvWorkspace).toEqual({ root: ".." });
    });

    it("omits uvLockPath / uvWorkspace fields when not requested (default config stays minimal)", () => {
        const config = pyproject();

        expect(config.uvLockPath).toBeUndefined();
        expect(config.uvWorkspace).toBeUndefined();
    });
});

describe("presets: gradleProperties", () => {
    it("uses the `version` property by default", () => {
        const config = gradleProperties();
        const rule = config.extraFiles![0]!;

        expect(rule.search).toContain("version");
        expect(rule.replace).toContain("version={version}");
    });

    it("uses a custom property name when provided", () => {
        const config = gradleProperties({ property: "projectVersion" });
        const rule = config.extraFiles![0]!;

        expect(rule.search).toContain("projectVersion");
        expect(rule.replace).toContain("projectVersion={version}");
    });

    it("regex matches a gradle.properties version line", () => {
        const rule = gradleProperties().extraFiles![0]!;
        const regex = new RegExp(rule.search, rule.flags);

        const props = "groupName=com.example\nversion=0.1.2\n";

        expect(regex.test(props)).toBe(true);
    });
});

describe("presets: pomXml", () => {
    it("emits a pom.xml rule WITHOUT the `g` flag (project version only)", () => {
        const config = pomXml();
        const rule = config.extraFiles![0]!;

        expect(rule.path).toBe("pom.xml");
        expect(rule.flags).toBe("");
    });

    it("regex matches the project version (first <version> tag)", () => {
        const rule = pomXml().extraFiles![0]!;
        const regex = new RegExp(rule.search, rule.flags);

        const pom = "<project>\n  <groupId>com.example</groupId>\n  <artifactId>foo</artifactId>\n  <version>0.1.2</version>\n</project>\n";

        expect(regex.test(pom)).toBe(true);

        const next = pom.replace(regex, rule.replace!.replace("{version}", "1.0.0"));

        expect(next).toContain("<version>1.0.0</version>");
    });
});

describe("presets: goMod", () => {
    it("emits zero rules by default (Go uses git tags, not manifest versions)", () => {
        expect(goMod().extraFiles).toEqual([]);
    });

    it("passes through extra rules when provided", () => {
        const config = goMod({
            extraFiles: [{ path: "version.go", replace: "Version = \"{version}\"", search: "Version = \"[^\"]+\"" }],
        });

        expect(config.extraFiles).toHaveLength(1);
    });
});
