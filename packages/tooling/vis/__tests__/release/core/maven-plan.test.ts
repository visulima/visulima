import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { planMavenWorkspace } from "../../../src/release/core/maven-plan";
import { discoverMavenProjects } from "../../../src/release/core/maven-projects";

const pom = (body: string): string => `<?xml version="1.0" encoding="UTF-8"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n${body}\n</project>\n`;

describe("maven-plan", () => {
    let cwd: string;
    let pending: Map<string, string>;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(cwd, rel, ".."), { recursive: true });
        writeFileSync(join(cwd, rel), content);
    };

    const read = (rel: string): string => pending.get(join(cwd, rel)) ?? readFileSync(join(cwd, rel), "utf8");

    const plan = async (releases: { name: string; newVersion: string }[]): Promise<Set<string>> => {
        const projects = await discoverMavenProjects({ claimedDirs: new Set(), cwd });

        return planMavenWorkspace({ pending, projects, releases });
    };

    beforeEach(() => {
        cwd = realpathSync(mkdtempSync(join(tmpdir(), "vis-maven-plan-")));
        pending = new Map();
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("bumps a literal version surgically, keeping comments and formatting", async () => {
        expect.hasAssertions();

        const original = pom(
            "<!-- was <version>0.0.1</version> -->\n<groupId>io.visulima</groupId>\n<artifactId>a</artifactId>\n    <version>  1.0.0 </version>",
        );

        write("pom.xml", original);

        await plan([{ name: "io.visulima:a", newVersion: "1.1.0" }]);

        expect(read("pom.xml")).toBe(original.replace("<version>  1.0.0 </version>", "<version>  1.1.0 </version>"));
    });

    it("preserves CRLF line endings", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>").replaceAll("\n", "\r\n"));

        await plan([{ name: "io.visulima:a", newVersion: "1.1.0" }]);

        expect(read("pom.xml")).toBe(pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.1.0</version>").replaceAll("\n", "\r\n"));
    });

    it("refuses a partial release of a group that shares one parent version", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version><modules><module>a</module><module>b</module></modules>"));
        write("a/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>a</artifactId>"));
        write("b/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>b</artifactId>"));

        const error = await plan([{ name: "io.visulima:a", newVersion: "3.1.0" }]).catch((error_: unknown) => error_);

        expect(error).toMatchObject({ code: "CONFIG_INVALID" });
        expect((error as Error).message).toContain("io.visulima:b");
        expect(pending.size).toBe(0);
    });

    it("refuses to release the aggregator alone when a child inherits its version", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version><modules><module>a</module></modules>"));
        write("a/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>a</artifactId>"));

        const error = await plan([{ name: "io.visulima:agg", newVersion: "3.1.0" }]).catch((error_: unknown) => error_);

        expect(error).toMatchObject({ code: "CONFIG_INVALID" });
        expect((error as Error).message).toContain("io.visulima:a");
        expect(pending.size).toBe(0);
    });

    it("releases a full group once, writing the shared parent version", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version><modules><module>a</module><module>b</module></modules>"));
        write("a/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>a</artifactId>"));
        write("b/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>b</artifactId>"));

        // The aggregator owns the shared version, so it is a member of the group too.
        await plan([
            { name: "io.visulima:agg", newVersion: "3.1.0" },
            { name: "io.visulima:a", newVersion: "3.1.0" },
            { name: "io.visulima:b", newVersion: "3.1.0" },
        ]);

        // The owner's literal moves once, the children keep inheriting it.
        expect(read("pom.xml")).toContain("<version>3.1.0</version>");
        expect(read("a/pom.xml")).toBe(pom("<parent><groupId>io.visulima</groupId><artifactId>agg</artifactId><version>3.0.0</version></parent><artifactId>a</artifactId>"));
    });

    it("rewrites a literal dependency on a released sibling", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>1.0.0</version><modules><module>a</module><module>b</module></modules>"));
        write("a/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));
        write(
            "b/pom.xml",
            pom(
                "<groupId>io.visulima</groupId><artifactId>b</artifactId><version>1.0.0</version><dependencies><dependency><groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version></dependency></dependencies>",
            ),
        );

        await plan([{ name: "io.visulima:a", newVersion: "1.1.0" }]);

        expect(read("a/pom.xml")).toContain("<version>1.1.0</version>");
        expect(read("b/pom.xml")).toContain("<artifactId>a</artifactId><version>1.1.0</version>");
    });

    it("leaves a dependency on a property version alone; the property moves with its owner", async () => {
        expect.hasAssertions();

        write(
            "pom.xml",
            pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version><properties><revision>1.0.0</revision></properties><modules><module>a</module><module>b</module></modules>"),
        );
        write("a/pom.xml", pom("<parent><groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version></parent><artifactId>a</artifactId>"));
        write(
            "b/pom.xml",
            pom(
                "<parent><groupId>io.visulima</groupId><artifactId>root</artifactId><version>${revision}</version></parent><artifactId>b</artifactId><dependencies><dependency><groupId>io.visulima</groupId><artifactId>a</artifactId><version>${revision}</version></dependency></dependencies>",
            ),
        );

        const before = read("b/pom.xml");

        await plan([
            { name: "io.visulima:root", newVersion: "1.1.0" },
            { name: "io.visulima:a", newVersion: "1.1.0" },
            { name: "io.visulima:b", newVersion: "1.1.0" },
        ]);

        expect(read("pom.xml")).toContain("<revision>1.1.0</revision>");
        expect(read("b/pom.xml")).toBe(before);
    });

    it("refuses a release that matches no discovered module, instead of skipping it", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));

        await expect(plan([{ name: "io.visulima:ghost", newVersion: "1.1.0" }])).rejects.toMatchObject({ code: "CONFIG_INVALID" });
    });

    it("leaves a Maven range dependency alone", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>root</artifactId><version>1.0.0</version><modules><module>a</module><module>b</module></modules>"));
        write("a/pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));
        write(
            "b/pom.xml",
            pom(
                "<groupId>io.visulima</groupId><artifactId>b</artifactId><version>1.0.0</version><dependencies><dependency><groupId>io.visulima</groupId><artifactId>a</artifactId><version>[1.0,2.0)</version></dependency></dependencies>",
            ),
        );

        const before = read("b/pom.xml");

        await plan([{ name: "io.visulima:a", newVersion: "1.1.0" }]);

        expect(read("b/pom.xml")).toBe(before);
    });

    it("refuses a version owner with no literal <version> to write", async () => {
        expect.hasAssertions();

        write("pom.xml", pom("<groupId>io.visulima</groupId><artifactId>a</artifactId><version>1.0.0</version>"));

        // Discovery saw a literal; the file changed under it before the plan ran.
        const projects = await discoverMavenProjects({ claimedDirs: new Set(), cwd });

        pending.set(join(cwd, "pom.xml"), pom("<groupId>io.visulima</groupId><artifactId>a</artifactId>"));

        await expect(planMavenWorkspace({ pending, projects, releases: [{ name: "io.visulima:a", newVersion: "1.1.0" }] })).rejects.toMatchObject({
            code: "CONFIG_INVALID",
        });
    });
});
