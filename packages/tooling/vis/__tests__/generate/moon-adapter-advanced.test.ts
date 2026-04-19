import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadMoonTemplate } from "../../src/generate/moon-adapter";
import type { CreationDirectory, CreationFile } from "../../src/generate/types";

const here = dirname(fileURLToPath(import.meta.url));
const MOON_COMPONENT = join(here, "../__fixtures__/generate/moon-component");
const MOON_ADVANCED = join(here, "../__fixtures__/generate/moon-advanced");

const baseBuiltins = {
    dest_dir: "/tmp/dest",
    dest_rel_dir: "dest",
    working_dir: "/tmp",
    workspace_root: "/tmp",
};

const flatten = (tree: CreationDirectory, prefix = ""): Record<string, CreationFile> => {
    const out: Record<string, CreationFile> = {};

    for (const [key, value] of Object.entries(tree)) {
        const path = prefix ? `${prefix}/${key}` : key;

        if (typeof value === "string" || Buffer.isBuffer(value)) {
            out[path] = value;
        } else if (value && typeof value === "object") {
            Object.assign(out, flatten(value, path));
        }
    }

    return out;
};

describe("moon adapter — binary passthrough", () => {
    it("should read non-text files (e.g. .png) as Buffers and skip Tera", async () => {
        expect.assertions(3);

        const template = loadMoonTemplate(MOON_COMPONENT, "component");
        const creation = await template.produce({
            builtins: baseBuiltins,
            options: { name: "Card", style: "primary", withTest: false },
        });

        const files = flatten(creation.files ?? {});
        const logo = files["logo.png"];

        expect(logo).toBeDefined();
        expect(Buffer.isBuffer(logo)).toBe(true);

        // Fixture starts with a fake PNG signature + NULs — no Tera would
        // have left those bytes intact if it tried to render.
        expect((logo as Buffer).subarray(0, 4).toString("binary")).toBe("\u0089PNG");
    });
});

describe("moon adapter — advanced (to, force, comparison if, nested partials)", () => {
    it("should honour frontmatter `to:` with filter interpolation", async () => {
        expect.assertions(2);

        const template = loadMoonTemplate(MOON_ADVANCED, "advanced");
        const creation = await template.produce({
            builtins: baseBuiltins,
            options: { mode: "dev", name: "MyWidget" },
        });

        const files = flatten(creation.files ?? {});

        expect(files["out/my-widget/index.ts"]).toBeDefined();
        // Original source path must not appear.
        expect(files["source.ts"]).toBeUndefined();
    });

    it("should populate filesMeta when frontmatter sets force: true", async () => {
        expect.assertions(1);

        const template = loadMoonTemplate(MOON_ADVANCED, "advanced");
        const creation = await template.produce({
            builtins: baseBuiltins,
            options: { mode: "dev", name: "Widget" },
        });

        expect(creation.filesMeta?.["out/widget/index.ts"]).toStrictEqual({ force: true });
    });

    it('should evaluate `if: mode == "prod"` — include only in prod mode', async () => {
        expect.assertions(2);

        const template = loadMoonTemplate(MOON_ADVANCED, "advanced");

        const dev = await template.produce({ builtins: baseBuiltins, options: { mode: "dev", name: "w" } });
        const prod = await template.produce({ builtins: baseBuiltins, options: { mode: "prod", name: "w" } });

        expect(flatten(dev.files ?? {})["prod-only.ts"]).toBeUndefined();
        expect(flatten(prod.files ?? {})["prod-only.ts"]).toBeDefined();
    });

    it('should resolve `{% include "layouts/header" %}` by relative path', async () => {
        expect.assertions(1);

        const template = loadMoonTemplate(MOON_ADVANCED, "advanced");
        const creation = await template.produce({
            builtins: baseBuiltins,
            options: { mode: "dev", name: "Thing" },
        });

        const files = flatten(creation.files ?? {});
        const content = files["out/thing/index.ts"] as string;

        expect(content).toContain("// Header for Thing");
    });
});

describe("moon adapter — error paths", () => {
    it("should throw when template.yml is missing", () => {
        expect.assertions(1);

        expect(() => loadMoonTemplate(join(here, "../__fixtures__/generate/does-not-exist"), "x")).toThrow();
    });
});

describe("moon adapter — destination path normalization", () => {
    const MOON_NORMALIZE = join(here, "../__fixtures__/generate/moon-normalize");

    it("should normalise `./path` and collapsed slashes so filesMeta keys match the runner's flattened paths", async () => {
        expect.assertions(3);

        const template = loadMoonTemplate(MOON_NORMALIZE, "normalize");
        const creation = await template.produce({ builtins: baseBuiltins, options: {} });
        const files = flatten(creation.files ?? {});

        // The runner will see `out/foo.ts` (flattened, no leading `./`, single `/`).
        expect(files["out/foo.ts"]).toBeDefined();
        expect(creation.filesMeta?.["out/foo.ts"]).toStrictEqual({ force: true });
        // The unnormalised key MUST NOT leak through, otherwise the
        // runner's force lookup misses.
        expect(creation.filesMeta?.["./out//foo.ts"]).toBeUndefined();
    });
});
