import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeApprovedBuildsToVisConfig } from "../../src/config/config-writer";

describe(writeApprovedBuildsToVisConfig, () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), "vis-cfg-writer-"));
    });

    afterEach(() => {
        if (existsSync(tmpDir)) {
            rmSync(tmpDir, { force: true, recursive: true });
        }
    });

    it("returns no-config when there is no vis.config file", () => {
        expect.assertions(2);

        const result = writeApprovedBuildsToVisConfig(tmpDir, ["esbuild"]);

        expect(result.status).toBe("no-config");
        expect(result.skipped).toStrictEqual(["esbuild"]);
    });

    it("injects a security.policies.installScripts.allow block when neither security nor policies exists", () => {
        expect.assertions(3);

        const configPath = join(tmpDir, "vis.config.ts");

        writeFileSync(configPath, "import { defineConfig } from \"@visulima/vis/config\";\n\nexport default defineConfig({\n    name: \"demo\",\n});\n");

        const result = writeApprovedBuildsToVisConfig(tmpDir, ["esbuild", "sharp"]);
        const content = readFileSync(configPath, "utf8");

        expect(result.status).toBe("updated");
        expect(result.added).toStrictEqual(["esbuild", "sharp"]);
        expect(content).toContain("\"esbuild\": true,");
    });

    it("inserts into an existing installScripts.allow block and dedups existing keys", () => {
        expect.assertions(3);

        const configPath = join(tmpDir, "vis.config.ts");

        writeFileSync(
            configPath,
            "import { defineConfig } from \"@visulima/vis/config\";\n\nexport default defineConfig({\n    security: {\n        policies: {\n            installScripts: {\n                allow: {\n                    \"esbuild\": true,\n                },\n            },\n        },\n    },\n});\n",
        );

        const result = writeApprovedBuildsToVisConfig(tmpDir, ["esbuild", "sharp"]);
        const content = readFileSync(configPath, "utf8");

        expect(result.status).toBe("updated");
        expect(result.added).toStrictEqual(["sharp"]);
        expect(content).toContain("\"sharp\": true,");
    });

    it("returns noop when every requested entry is already present", () => {
        expect.assertions(2);

        const configPath = join(tmpDir, "vis.config.ts");

        writeFileSync(
            configPath,
            "import { defineConfig } from \"@visulima/vis/config\";\n\nexport default defineConfig({\n    security: {\n        policies: {\n            installScripts: {\n                allow: {\n                    \"esbuild\": true,\n                },\n            },\n        },\n    },\n});\n",
        );

        const result = writeApprovedBuildsToVisConfig(tmpDir, ["esbuild"]);

        expect(result.status).toBe("noop");
        expect(result.skipped).toStrictEqual(["esbuild"]);
    });

    it("adds allow block to an existing installScripts block without allow", () => {
        expect.assertions(3);

        const configPath = join(tmpDir, "vis.config.ts");

        writeFileSync(
            configPath,
            "import { defineConfig } from \"@visulima/vis/config\";\n\nexport default defineConfig({\n    security: {\n        policies: {\n            installScripts: {\n                strict: true,\n            },\n        },\n    },\n});\n",
        );

        const result = writeApprovedBuildsToVisConfig(tmpDir, ["esbuild"]);
        const content = readFileSync(configPath, "utf8");

        expect(result.status).toBe("updated");
        expect(content).toContain("strict: true");
        expect(content).toContain("\"esbuild\": true,");
    });
});
