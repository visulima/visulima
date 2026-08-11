import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import packageJson from "../package.json";
import packemConfig from "../packem.config";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const exclude = ((packemConfig as any).rollup?.resolveExternals?.exclude ?? []) as (RegExp | string)[];

const isInlined = (name: string): boolean => exclude.some((entry) => (typeof entry === "string" ? entry === name : entry.test(name)));

const carriesReact = (name: string): boolean => {
    const manifestPath = join(packageRoot, "node_modules", name, "package.json");

    if (!existsSync(manifestPath)) {
        return false;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, Record<string, string> | undefined>;

    return Boolean(manifest.dependencies?.react ?? manifest.peerDependencies?.react);
};

describe("packem react externals", () => {
    // A dependency that brings its own React must be inlined into the vis bundle.
    // Left external it resolves a second copy of React at runtime, whose dispatcher
    // the inlined react-reconciler never sets -> "Invalid hook call" on first render.
    it("inlines every dependency that carries react", () => {
        expect.assertions(1);

        const external = Object.keys(packageJson.dependencies)
            .filter((name) => carriesReact(name))
            .filter((name) => !isInlined(name));

        expect(external).toStrictEqual([]);
    });

    it("inlines react itself and its subpaths", () => {
        expect.assertions(3);

        expect(isInlined("react")).toBe(true);
        expect(isInlined("react/jsx-runtime")).toBe(true);
        expect(isInlined("react-reconciler")).toBe(true);
    });
});
