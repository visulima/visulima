import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { checkImportBoundaries } from "../../src/import-boundaries";
import type { ProjectGraph } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `boundaries-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const makeGraph = (projects: Record<string, { root: string }>): ProjectGraph => {
    const nodes: ProjectGraph["nodes"] = {};

    for (const [name, { root }] of Object.entries(projects)) {
        nodes[name] = {
            data: { root },
            name,
            type: "library",
        };
    }

    return { dependencies: {}, nodes };
};

describe(checkImportBoundaries, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    const writeProject = async (root: string, packageJson: Record<string, unknown>): Promise<void> => {
        await mkdir(join(workspaceRoot, root, "src"), { recursive: true });
        await writeFile(join(workspaceRoot, root, "package.json"), JSON.stringify(packageJson));
    };

    const writeSource = async (root: string, file: string, content: string): Promise<void> => {
        await writeFile(join(workspaceRoot, root, file), content);
    };

    it("flags a bare import of an undeclared dependency", async () => {
        expect.assertions(3);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import x from "lodash";\nexport const y = x;`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(1);
        expect(violations[0]?.rule).toBe("import-boundary");
        expect(violations[0]?.message).toContain("lodash");
    });

    it("does not flag a declared dependency", async () => {
        expect.assertions(1);

        await writeProject("packages/app", { dependencies: { lodash: "^4.0.0" }, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import x from "lodash";\nexport const y = x;`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(0);
    });

    it("does not flag a node: builtin", async () => {
        expect.assertions(1);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import { readFile } from "node:fs";\nimport { join } from "path";\nexport const y = [readFile, join];`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(0);
    });

    it("flags a relative import that escapes the package directory", async () => {
        expect.assertions(2);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import secret from "../../other/src/secret";\nexport const y = secret;`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(1);
        expect(violations[0]?.message).toContain("outside the package directory");
    });

    it("does not flag a relative import that stays inside the package", async () => {
        expect.assertions(1);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import helper from "./helper";\nexport const y = helper;`);
        await writeSource("packages/app", "src/helper.ts", `export default 1;`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(0);
    });

    it("flags a deep workspace import when allowDeepImports is false and allows it when true", async () => {
        expect.assertions(4);

        await writeProject("packages/app", { dependencies: { "@app/core": "workspace:*" }, name: "app" });
        await writeProject("packages/core", { name: "@app/core" });
        await writeSource("packages/app", "src/index.ts", `import internal from "@app/core/src/internal/secret";\nexport const y = internal;`);

        const graph = makeGraph({ "@app/core": { root: "packages/core" }, app: { root: "packages/app" } });

        const strict = await checkImportBoundaries(graph, { workspaceRoot });

        expect(strict).toHaveLength(1);
        expect(strict[0]?.message).toContain("deep-imports");

        const relaxed = await checkImportBoundaries(graph, { allowDeepImports: true, workspaceRoot });

        expect(relaxed).toHaveLength(0);

        // A non-deep import of the same workspace package is always fine.
        await writeSource("packages/app", "src/index.ts", `import core from "@app/core";\nexport const y = core;`);

        const shallow = await checkImportBoundaries(graph, { workspaceRoot });

        expect(shallow).toHaveLength(0);
    });

    it("ignores type-only imports", async () => {
        expect.assertions(1);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import type { Thing } from "some-types-only";\nexport type T = Thing;`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(0);
    });

    it("skips a file matched by an ignore glob", async () => {
        expect.assertions(2);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `import x from "lodash";\nexport const y = x;`);
        await writeSource("packages/app", "src/story.stories.tsx", `import z from "storybook-only";\nexport const s = z;`);

        const graph = makeGraph({ app: { root: "packages/app" } });

        const withIgnore = await checkImportBoundaries(graph, { ignore: ["**/*.stories.tsx"], workspaceRoot });

        // only the index.ts violation remains; the stories file is skipped
        expect(withIgnore).toHaveLength(1);
        expect(withIgnore[0]?.message).toContain("lodash");
    });

    it("flags undeclared require() and dynamic import() specifiers", async () => {
        expect.assertions(1);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource(
            "packages/app",
            "src/index.ts",
            `const a = require("undeclared-a");\nexport const load = () => import("undeclared-b");\nexport const x = a;`,
        );

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toHaveLength(2);
    });

    it("returns an empty array for a clean workspace", async () => {
        expect.assertions(1);

        await writeProject("packages/app", { dependencies: {}, name: "app" });
        await writeSource("packages/app", "src/index.ts", `export const y = 1;`);

        const violations = await checkImportBoundaries(makeGraph({ app: { root: "packages/app" } }), { workspaceRoot });

        expect(violations).toStrictEqual([]);
    });
});
