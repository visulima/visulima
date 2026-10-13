import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import sbomCommand from "../../src/commands/sbom/handler";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

const POM = [
    "<project>",
    "  <modelVersion>4.0.0</modelVersion>",
    "  <groupId>com.example</groupId>",
    "  <artifactId>app</artifactId>",
    "  <version>1.0.0</version>",
    "  <dependencies>",
    "    <dependency><groupId>org.slf4j</groupId><artifactId>slf4j-api</artifactId><version>2.0.9</version></dependency>",
    "  </dependencies>",
    "</project>",
].join("\n");

const NOTICE
    = "vis sbom: ecosystems found by file, which does not show they are used. "
        + "pom.xml found; not included. Set maven.discover or add 'maven' to sbom.ecosystems.";

interface RunResult {
    notices: string[];
    stdout: string;
}

describe("vis sbom: stderr notice for found, not opted-in ecosystems", () => {
    let root: string;

    beforeEach(() => {
        root = join(createTemporaryDirectory("vis-sbom-cmd-"), "repo");
        ensureDirSync(root);
        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "root", version: "1.0.0", workspaces: ["packages/*"] }));
        writeFileSync(join(root, "pom.xml"), POM);
    });

    afterEach(() => {
        cleanupTemporaryDirectory(join(root, ".."));
        vi.restoreAllMocks();
    });

    const run = async (visConfig: Record<string, unknown>): Promise<RunResult> => {
        const notices: string[] = [];
        let stdout = "";

        vi.spyOn(process.stdout, "write").mockImplementation((chunk: string | Uint8Array) => {
            stdout += String(chunk);

            return true;
        });

        const toolbox = {
            console: { error: (message: string) => notices.push(message) },
            fs: {},
            options: { format: "json", output: "-" },
            visConfig,
            workspaceRoot: root,
        };

        await (sbomCommand as unknown as (toolbox: unknown) => Promise<void>)(toolbox);

        return { notices, stdout };
    };

    it("prints the notice once on stderr and keeps the BOM on stdout parseable", async () => {
        expect.hasAssertions();

        const { notices, stdout } = await run({});

        expect(notices).toStrictEqual([NOTICE]);
        expect(JSON.parse(stdout).components.map((component: { name: string }) => component.name)).not.toContain("slf4j-api");
    });

    it("prints no notice and includes the module when maven.discover is on", async () => {
        expect.hasAssertions();

        const { notices, stdout } = await run({ maven: { discover: true } });

        expect(notices).toStrictEqual([]);
        expect(JSON.parse(stdout).components.map((component: { name: string }) => component.name)).toContain("slf4j-api");
    });
});
