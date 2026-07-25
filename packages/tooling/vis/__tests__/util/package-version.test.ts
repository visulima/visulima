import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const manifestVersion = (JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as { version: string }).version;

const importFresh = async () => {
    vi.resetModules();

    const imported = await import("../../src/util/package-version");

    return imported.default;
};

describe("getPackageVersion", () => {
    const originalVersion = process.env["VIS_VERSION"];

    beforeEach(() => {
        delete process.env["VIS_VERSION"];
    });

    afterEach(() => {
        if (originalVersion === undefined) {
            delete process.env["VIS_VERSION"];
        } else {
            process.env["VIS_VERSION"] = originalVersion;
        }
    });

    // The bundler inlines `package.json` at build time, but CI builds before
    // semantic-release bumps the manifest — so an inlined literal always ships one
    // release behind (visulima/visulima#741). Read the manifest that shipped.
    it("should read the version from the package manifest, not a build-time literal", async () => {
        expect.assertions(1);

        const getPackageVersion = await importFresh();

        expect(getPackageVersion()).toBe(manifestVersion);
    });

    it("should prefer VIS_VERSION so child processes report their parent's version", async () => {
        expect.assertions(1);

        process.env["VIS_VERSION"] = "9.9.9-child";

        const getPackageVersion = await importFresh();

        expect(getPackageVersion()).toBe("9.9.9-child");
    });

    it("should cache the resolved version", async () => {
        expect.assertions(2);

        const getPackageVersion = await importFresh();
        const first = getPackageVersion();

        process.env["VIS_VERSION"] = "0.0.0-changed-after-first-call";

        expect(getPackageVersion()).toBe(first);
        expect(first).toBe(manifestVersion);
    });
});
