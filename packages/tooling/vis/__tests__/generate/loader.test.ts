import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it } from "vitest";

import { loadNativeTemplate } from "../../src/generate/loader";
import type { CreationDirectory, CreationFile } from "../../src/generate/types";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "../../__fixtures__/generate/native/package.ts");

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

describe(loadNativeTemplate, () => {
    it("should load a native template module via jiti", async () => {
        expect.assertions(1);

        const template = await loadNativeTemplate(FIXTURE);

        expect(template.about.name).toBe("package");

        expectTypeOf(template.produce).toBeFunction();
    });

    it("should produce files via the imported template", async () => {
        expect.assertions(3);

        const template = await loadNativeTemplate(FIXTURE);
        const creation = await template.produce({
            builtins: { dest_dir: "/tmp", dest_rel_dir: ".", working_dir: "/tmp", workspace_root: "/tmp" },
            options: { category: "tooling", name: "scoop" },
        });

        const files = flatten(creation.files ?? {});

        expect(files["packages/tooling/scoop/package.json"]).toContain('"name": "scoop"');
        expect(files["packages/tooling/scoop/src/index.ts"]).toBe("export {};\n");
        expect(creation.suggestions).toStrictEqual(["Run pnpm install"]);
    });

    it("should reject modules without a default export", async () => {
        expect.assertions(1);

        await expect(loadNativeTemplate(join(here, "../../__fixtures__/generate/native/missing.ts"))).rejects.toThrow();
    });
});
