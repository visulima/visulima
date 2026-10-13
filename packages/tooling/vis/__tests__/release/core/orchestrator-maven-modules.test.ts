import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { formatChangeFile, parseChangeFile } from "../../../src/release/core/change-file";
import { applyContext, buildContext } from "../../../src/release/core/orchestrator";

/**
 * End to end through buildContext and applyContext, with Maven module discovery
 * on. `a` gets a minor bump; `b` depends on `a` at a literal 1.0.0. The dependency
 * graph treats that literal as a range (`1.0.0` only accepts 1.0.0), so `b` is
 * pulled in as a patch bump, and its literal dependency moves to 1.1.0.
 */
describe.skipIf(process.platform === "win32")("orchestrator: opt-in Maven module releases", () => {
    let cwd: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const pom = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n${body}\n</project>\n`;

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-orch-maven-")));

        write("package.json", "{\n    \"name\": \"root\",\n    \"private\": true,\n    \"version\": \"0.0.0\"\n}\n");
        write("pnpm-workspace.yaml", "packages: []\n");
        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>0.0.0</version><modules><module>a</module><module>b</module></modules>"),
        );
        write("a/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));
        write(
            "b/pom.xml",
            pom(
                "<groupId>io.visulima</groupId><artifactId>b</artifactId><version>1.0.0</version><dependencies><dependency><groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version></dependency></dependencies>",
            ),
        );
        write(".vis/release/x.md", "---\n\"io.visulima:a\": minor\n---\n### Minor a\n\nBody\n");
        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true, maven: { discover: true } } };\n");
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps a minor, patch-bumps its dependent, and rewrites the dependent's literal", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        expect(ctx.plan.releases.map((r) => [r.name, r.newVersion]).sort()).toStrictEqual([
            ["io.visulima:a", "1.1.0"],
            ["io.visulima:b", "1.0.1"],
        ]);

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "a", "pom.xml"), "utf8")).toContain("<version>1.1.0</version>");
        expect(readFileSync(join(cwd, "b", "pom.xml"), "utf8")).toContain("<version>1.0.1</version>");
        expect(readFileSync(join(cwd, "b", "pom.xml"), "utf8")).toContain("<artifactId>a</artifactId><version>1.1.0</version>");
    });

    it("never writes a Maven module as package.json", async () => {
        expect.hasAssertions();

        const ctx = await buildContext({ cwd });

        await applyContext(ctx, { dryRun: false });

        expect(readFileSync(join(cwd, "a", "pom.xml"), "utf8").startsWith("<?xml")).toBe(true);
    });

    it("skips a module that a JS package already releases through an extraFiles pom rule", async () => {
        expect.hasAssertions();

        write("pnpm-workspace.yaml", "packages:\n  - \"packages/*\"\n");
        write("packages/web/package.json", "{\n    \"name\": \"web\",\n    \"version\": \"0.0.0\"\n}\n");
        write("packages/web/jvm/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>jvm</artifactId><version>2.0.0</version>"));
        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>0.0.0</version><modules><module>a</module><module>b</module><module>packages/web/jvm</module></modules>"),
        );
        // The rule's path is relative to the package directory, as pomXml({ pomDir: "jvm" }) writes it.
        write(
            "vis.config.cjs",
            "module.exports = { release: { acknowledgeUnstable: true, maven: { discover: true }, packages: { web: { managed: true, extraFiles: [{ flags: \"\", path: \"jvm/pom.xml\", replace: \"$1{version}$3\", search: \"(<version>)([^<]+)(</version>)\" }], versionActions: \"maven\" } } } };\n",
        );

        const ctx = await buildContext({ cwd });
        const names = ctx.packages.filter((pkg) => pkg.ecosystem === "maven").map((pkg) => pkg.name);

        expect(ctx.packages.map((pkg) => pkg.name)).toContain("web");

        expect(names).toContain("io.visulima:root");
        expect(names).toContain("io.visulima:a");
        expect(names).not.toContain("io.visulima:jvm");
    });

    it("reads back a change file that names a Maven module", () => {
        expect.hasAssertions();

        const written = formatChangeFile({ bumps: { "io.visulima:a": "minor" } }, "Body");
        const parsed = parseChangeFile(written, ".vis/release/x.md");

        expect(written).toContain("io.visulima:a: minor");
        expect(JSON.stringify(parsed)).toContain("io.visulima:a");
    });

    it("discovers no modules unless release.maven.discover is on", async () => {
        expect.hasAssertions();

        write("vis.config.cjs", "module.exports = { release: { acknowledgeUnstable: true } };\n");

        const ctx = await buildContext({ cwd });

        expect(ctx.packages.filter((pkg) => pkg.ecosystem === "maven")).toStrictEqual([]);
    });
});
