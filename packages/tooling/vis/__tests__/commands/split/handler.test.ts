import { describe, expect, it } from "vitest";

import splitExecute, { resolvePackageDirectory } from "../../../src/commands/split/handler";
import type { VisProjectConfiguration } from "../../../src/config/workspace";

const projects = (entries: Record<string, string>): Record<string, VisProjectConfiguration> => {
    const out: Record<string, VisProjectConfiguration> = {};

    for (const [name, root] of Object.entries(entries)) {
        out[name] = { root };
    }

    return out;
};

describe(resolvePackageDirectory, () => {
    it("resolves a project name to its root", async () => {
        expect.assertions(1);

        const result = await resolvePackageDirectory("@scope/foo", projects({ "@scope/foo": "packages/foo" }), async () => false);

        expect(result).toStrictEqual({ pkgName: "@scope/foo", relativeDir: "packages/foo" });
    });

    it("falls back to a path when no project name matches", async () => {
        expect.assertions(1);

        const result = await resolvePackageDirectory("packages/bar", projects({}), async (dir) => dir === "packages/bar");

        expect(result).toStrictEqual({ pkgName: "bar", relativeDir: "packages/bar" });
    });

    it("returns undefined for an unknown package", async () => {
        expect.assertions(1);

        const result = await resolvePackageDirectory("nope", projects({}), async () => false);

        expect(result).toBeUndefined();
    });
});

// Validation runs before any git/fs access, so a bare toolbox suffices.
const runExecute = async (argument: string[], options: Record<string, unknown>): Promise<void> => {
    await (splitExecute as any)({ argument, options });
};

describe("split handler validation", () => {
    it("throws when no package argument is given", async () => {
        expect.assertions(1);

        await expect(runExecute([], {})).rejects.toThrow(/Missing <package>/u);
    });

    it("throws when --output is missing and not a dry run", async () => {
        expect.assertions(1);

        await expect(runExecute(["@scope/foo"], { dryRun: false })).rejects.toThrow(/Missing --output/u);
    });
});
