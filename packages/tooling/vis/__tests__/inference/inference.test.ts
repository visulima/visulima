import { mkdirSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { BUILT_IN_DETECTORS, inferProjectTargets } from "../../src/inference";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

let tmp: string;

const writeFile = (relative: string, contents: string): void => {
    const absolute = join(tmp, relative);

    mkdirSync(join(absolute, ".."), { recursive: true });
    writeFileSync(absolute, contents);
};

beforeEach(() => {
    tmp = createTemporaryDirectory("vis-inference-");
});

afterEach(() => {
    cleanupTemporaryDirectory(tmp);
});

describe(inferProjectTargets, () => {
    it("should return an empty result when nothing is detected", () => {
        expect.assertions(2);

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/foo",
            projectRoot: tmp,
        });

        expect(result.targets).toStrictEqual({});
        expect(result.sources).toStrictEqual([]);
    });

    it("should infer vite targets from a vite.config.ts", () => {
        expect.assertions(4);

        writeFile("vite.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/web",
            projectRoot: tmp,
        });

        expect(result.sources).toStrictEqual(["vite"]);
        expect(result.targets["build"]?.command).toBe("vite build");
        expect(result.targets["dev"]?.preset).toBe("server");
        expect(result.targets["preview"]?.preset).toBe("server");
    });

    it("should infer vitest targets from the dependency alone (no config file)", () => {
        expect.assertions(3);

        const result = inferProjectTargets({
            pkg: { devDependencies: { vitest: "^4.0.0" } },
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.sources).toStrictEqual(["vitest"]);
        expect(result.targets["test"]?.command).toBe("vitest run");
        // Without a config file, the inputs list omits the config ref —
        // confirms the optional spread doesn't crash.
        expect(result.targets["test"]?.inputs).not.toContain(undefined);
    });

    it("should infer packem targets from the @visulima/packem dep", () => {
        expect.assertions(3);

        const result = inferProjectTargets({
            pkg: { devDependencies: { "@visulima/packem": "^2.0.0" } },
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.sources).toStrictEqual(["packem"]);
        expect(result.targets["build"]?.command).toBe("packem build");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/dist");
    });

    it("should give the first detector priority when two declare the same target name", () => {
        expect.assertions(2);

        // Both vite (registered first) and packem ship a `build` target.
        // Vite must win and packem's build must be silently dropped.
        writeFile("vite.config.ts", "export default {}");
        writeFile("packem.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/web",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("vite build");
        // packem still ran, but didn't contribute a unique target — its
        // name should be absent from sources, since packem only had the
        // (now-shadowed) `build` target on offer in v1.
        expect(result.sources).toStrictEqual(["vite"]);
    });

    it("should combine targets across detectors that don't collide", () => {
        expect.assertions(3);

        writeFile("vite.config.ts", "export default {}");
        writeFile("vitest.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/app",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("vite build");
        expect(result.targets["test"]?.command).toBe("vitest run");
        expect(result.sources).toStrictEqual(["vite", "vitest"]);
    });

    it("should allow custom detector lists", () => {
        expect.assertions(2);

        writeFile("vite.config.ts", "export default {}");

        const result = inferProjectTargets(
            {
                pkg: {},
                projectDirectory: "packages/web",
                projectRoot: tmp,
            },
            BUILT_IN_DETECTORS.filter((detector) => detector.name === "vitest"),
        );

        // No vitest config → no inference, even though vite.config.ts exists.
        expect(result.targets).toStrictEqual({});
        expect(result.sources).toStrictEqual([]);
    });
});
