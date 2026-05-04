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

    it("should infer typecheck from a tsconfig.json", () => {
        expect.assertions(3);

        writeFile("tsconfig.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.sources).toContain("typescript");
        expect(result.targets["typecheck"]?.command).toBe("tsc --noEmit");
        expect(result.targets["typecheck"]?.outputs).toStrictEqual([]);
    });

    it("should infer lint from eslint.config.ts", () => {
        expect.assertions(2);

        writeFile("eslint.config.ts", "export default []");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["lint"]?.command).toBe("eslint .");
        expect(result.sources).toContain("eslint");
    });

    it("should infer prettier format + format:check from prettier.config.js", () => {
        expect.assertions(3);

        writeFile("prettier.config.js", "module.exports = {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["format"]?.command).toBe("prettier --write .");
        expect(result.targets["format:check"]?.command).toBe("prettier --check .");
        // format mutates files — must not be cached by default. The
        // detector signals this by omitting `type`, so defaultCacheForType
        // returns undefined.
        expect(result.targets["format"]?.type).toBeUndefined();
    });

    it("should infer biome lint + format from biome.json", () => {
        expect.assertions(2);

        writeFile("biome.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["lint"]?.command).toBe("biome check .");
        expect(result.targets["format"]?.command).toBe("biome format --write .");
    });

    it("should give eslint priority over biome on the lint target", () => {
        expect.assertions(2);

        writeFile("eslint.config.ts", "export default []");
        writeFile("biome.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["lint"]?.command).toBe("eslint .");
        // biome still claims `format` since prettier isn't configured.
        expect(result.targets["format"]?.command).toBe("biome format --write .");
    });

    it("should give prettier priority over biome on the format target", () => {
        expect.assertions(2);

        writeFile("prettier.config.js", "module.exports = {}");
        writeFile("biome.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["format"]?.command).toBe("prettier --write .");
        // biome still claims `lint` since eslint isn't configured.
        expect(result.targets["lint"]?.command).toBe("biome check .");
    });

    it("should infer tsup build from tsup.config.ts", () => {
        expect.assertions(2);

        writeFile("tsup.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("tsup");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/dist");
    });

    it("should infer tsdown build from tsdown.config.ts", () => {
        expect.assertions(2);

        writeFile("tsdown.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("tsdown");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/dist");
    });

    it("should infer rolldown build from rolldown.config.ts", () => {
        expect.assertions(2);

        writeFile("rolldown.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("rolldown -c");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/dist");
    });

    it("should not infer rolldown from a transitive dep alone", () => {
        expect.assertions(1);

        // No config file. Rolldown ships without a `fallbackDependency`
        // because vite/tsdown often pull it transitively.
        const result = inferProjectTargets({
            pkg: { devDependencies: { rolldown: "^1.0.0" } },
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]).toBeUndefined();
    });

    it("should infer next build/dev/start from next.config.ts", () => {
        expect.assertions(4);

        writeFile("next.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("next build");
        expect(result.targets["dev"]?.preset).toBe("server");
        expect(result.targets["start"]?.preset).toBe("server");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/.next");
    });

    it("should infer astro build/dev from astro.config.mjs", () => {
        expect.assertions(2);

        writeFile("astro.config.mjs", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/site",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("astro build");
        expect(result.targets["dev"]?.preset).toBe("server");
    });

    it("should give next priority over astro and vite on the build target", () => {
        expect.assertions(3);

        // Pathological: project has multiple framework configs. Order in
        // BUILT_IN_DETECTORS bakes in next > astro > vite.
        writeFile("next.config.ts", "export default {}");
        writeFile("astro.config.mjs", "export default {}");
        writeFile("vite.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("next build");
        expect(result.targets["dev"]?.command).toBe("next dev");
        // vite uniquely owns `preview` — it still contributes that even
        // though next shadowed `build`/`dev`.
        expect(result.targets["preview"]?.command).toBe("vite preview");
    });

    it("should infer storybook + build-storybook from .storybook/main.ts", () => {
        expect.assertions(3);

        writeFile(".storybook/main.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/ui",
            projectRoot: tmp,
        });

        expect(result.targets["storybook"]?.preset).toBe("server");
        expect(result.targets["build-storybook"]?.command).toBe("storybook build");
        expect(result.targets["build-storybook"]?.outputs).toContain("{projectRoot}/storybook-static");
    });

    it("should infer playwright test:e2e without colliding with vitest test", () => {
        expect.assertions(3);

        writeFile("playwright.config.ts", "export default {}");
        writeFile("vitest.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["test:e2e"]?.command).toBe("playwright test");
        // vitest still owns `test` — playwright deliberately uses a
        // unique target name to avoid the collision.
        expect(result.targets["test"]?.command).toBe("vitest run");
        expect(result.targets["test:e2e"]?.outputs).toContain("{projectRoot}/playwright-report");
    });

    it("should give vitest priority over jest on the test target", () => {
        expect.assertions(2);

        writeFile("vitest.config.ts", "export default {}");
        writeFile("jest.config.js", "module.exports = {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["test"]?.command).toBe("vitest run");
        // jest still ran but lost on `test`. Its `test:watch` is also
        // shadowed by vitest's earlier registration.
        expect(result.targets["test:watch"]?.command).toBe("vitest");
    });

    it("should infer jest test when only jest config is present", () => {
        expect.assertions(2);

        writeFile("jest.config.js", "module.exports = {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["test"]?.command).toBe("jest");
        expect(result.targets["test:watch"]?.command).toBe("jest --watch");
    });

    it("should infer oxlint as a fallback when eslint and biome are absent", () => {
        expect.assertions(1);

        writeFile(".oxlintrc.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["lint"]?.command).toBe("oxlint");
    });

    it("should infer oxfmt format + format:check from .oxfmtrc.json", () => {
        expect.assertions(3);

        writeFile(".oxfmtrc.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["format"]?.command).toBe("oxfmt");
        expect(result.targets["format:check"]?.command).toBe("oxfmt --check");
        // mutating target stays uncached (no `type` set).
        expect(result.targets["format"]?.type).toBeUndefined();
    });

    it("should give prettier > biome > oxfmt priority on format", () => {
        expect.assertions(2);

        writeFile("prettier.config.js", "module.exports = {}");
        writeFile("biome.json", "{}");
        writeFile(".oxfmtrc.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["format"]?.command).toBe("prettier --write .");
        expect(result.targets["format:check"]?.command).toBe("prettier --check .");
    });

    it("should infer nuxt build/dev/preview/generate from nuxt.config.ts", () => {
        expect.assertions(5);

        writeFile("nuxt.config.ts", "export default defineNuxtConfig({})");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("nuxt build");
        expect(result.targets["dev"]?.preset).toBe("server");
        expect(result.targets["preview"]?.preset).toBe("server");
        expect(result.targets["generate"]?.command).toBe("nuxt generate");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/.output");
    });

    it("should give nuxt priority over next, remix, astro and vite on build", () => {
        expect.assertions(2);

        writeFile("nuxt.config.ts", "export default {}");
        writeFile("next.config.ts", "export default {}");
        writeFile("remix.config.js", "module.exports = {}");
        writeFile("astro.config.mjs", "export default {}");
        writeFile("vite.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("nuxt build");
        // vite still uniquely owns `preview` shadowed by nuxt; nuxt's
        // `preview` (also server preset) wins the slot.
        expect(result.targets["preview"]?.command).toBe("nuxt preview");
    });

    it("should infer remix build/dev/start from remix.config.js", () => {
        expect.assertions(3);

        writeFile("remix.config.js", "module.exports = {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/site",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("remix vite:build");
        expect(result.targets["dev"]?.preset).toBe("server");
        expect(result.targets["start"]?.preset).toBe("server");
    });

    it("should not infer remix from a transitive @remix-run dep alone", () => {
        expect.assertions(1);

        const result = inferProjectTargets({
            pkg: { devDependencies: { "@remix-run/react": "^2.0.0" } },
            projectDirectory: "packages/ui",
            projectRoot: tmp,
        });

        expect(result.targets["build"]).toBeUndefined();
    });

    it("should infer nest build/start/start:dev from nest-cli.json", () => {
        expect.assertions(3);

        writeFile("nest-cli.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/api",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("nest build");
        expect(result.targets["start"]?.command).toBe("nest start");
        expect(result.targets["start:dev"]?.preset).toBe("server");
    });

    it("should infer knip from knip.json", () => {
        expect.assertions(2);

        writeFile("knip.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["knip"]?.command).toBe("knip");
        expect(result.targets["knip"]?.outputs).toStrictEqual([]);
    });

    it("should infer stylelint lint:css without colliding with eslint lint", () => {
        expect.assertions(2);

        writeFile("eslint.config.ts", "export default []");
        writeFile(".stylelintrc.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/ui",
            projectRoot: tmp,
        });

        expect(result.targets["lint"]?.command).toBe("eslint .");
        // stylelint deliberately uses lint:css so it can coexist.
        expect(result.targets["lint:css"]?.command).toBe('stylelint "**/*.{css,scss,sass,less,vue,svelte,astro}"');
    });

    it("should infer rollup build from rollup.config.ts", () => {
        expect.assertions(2);

        writeFile("rollup.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("rollup -c");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/dist");
    });

    it("should not infer rollup from a transitive dep alone", () => {
        expect.assertions(1);

        const result = inferProjectTargets({
            pkg: { devDependencies: { rollup: "^4.0.0" } },
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]).toBeUndefined();
    });

    it("should infer cypress test:e2e + cypress:open from cypress.config.ts", () => {
        expect.assertions(3);

        writeFile("cypress.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["test:e2e"]?.command).toBe("cypress run");
        expect(result.targets["cypress:open"]?.preset).toBe("server");
        expect(result.targets["test:e2e"]?.outputs).toContain("{projectRoot}/cypress/screenshots");
    });

    it("should give playwright priority over cypress on test:e2e", () => {
        expect.assertions(2);

        writeFile("playwright.config.ts", "export default {}");
        writeFile("cypress.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/web",
            projectRoot: tmp,
        });

        expect(result.targets["test:e2e"]?.command).toBe("playwright test");
        // cypress still uniquely owns cypress:open
        expect(result.targets["cypress:open"]?.command).toBe("cypress open");
    });

    it("should infer vitepress docs:* targets from .vitepress/config.ts", () => {
        expect.assertions(3);

        writeFile(".vitepress/config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/docs",
            projectRoot: tmp,
        });

        expect(result.targets["docs:build"]?.command).toBe("vitepress build .");
        expect(result.targets["docs:dev"]?.preset).toBe("server");
        expect(result.targets["docs:preview"]?.preset).toBe("server");
    });

    it("should resolve vitepress docs/ subdirectory configs", () => {
        expect.assertions(2);

        writeFile("docs/.vitepress/config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/site",
            projectRoot: tmp,
        });

        expect(result.targets["docs:build"]?.command).toBe("vitepress build docs");
        expect(result.targets["docs:build"]?.outputs).toContain("{projectRoot}/docs/.vitepress/dist");
    });

    it("should infer docusaurus build/start/serve from docusaurus.config.ts", () => {
        expect.assertions(3);

        writeFile("docusaurus.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/docs",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("docusaurus build");
        expect(result.targets["start"]?.preset).toBe("server");
        expect(result.targets["serve"]?.preset).toBe("server");
    });

    it("should infer bun test from bunfig.toml", () => {
        expect.assertions(2);

        writeFile("bunfig.toml", "");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["test"]?.command).toBe("bun test");
        expect(result.targets["test"]?.type).toBe("test");
    });

    it("should give vitest priority over bun on test", () => {
        expect.assertions(1);

        writeFile("vitest.config.ts", "export default {}");
        writeFile("bunfig.toml", "");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["test"]?.command).toBe("vitest run");
    });

    it("should infer deno test/lint/fmt/check from deno.json", () => {
        expect.assertions(4);

        writeFile("deno.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["test"]?.command).toBe("deno test");
        expect(result.targets["lint"]?.command).toBe("deno lint");
        expect(result.targets["fmt"]?.command).toBe("deno fmt");
        expect(result.targets["check"]?.command).toBe("deno check **/*.ts");
    });

    it("should let eslint and vitest beat deno on lint and test", () => {
        expect.assertions(4);

        writeFile("eslint.config.ts", "export default []");
        writeFile("vitest.config.ts", "export default {}");
        writeFile("deno.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["lint"]?.command).toBe("eslint .");
        expect(result.targets["test"]?.command).toBe("vitest run");
        // deno still uniquely owns fmt and check
        expect(result.targets["fmt"]?.command).toBe("deno fmt");
        expect(result.targets["check"]?.command).toBe("deno check **/*.ts");
    });

    it("should infer typedoc docs from typedoc.json", () => {
        expect.assertions(2);

        writeFile("typedoc.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["docs"]?.command).toBe("typedoc");
        expect(result.targets["docs"]?.outputs).toContain("{projectRoot}/docs");
    });

    it("should infer gatsby build/develop/serve from gatsby-config.ts", () => {
        expect.assertions(3);

        writeFile("gatsby-config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/site",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("gatsby build");
        expect(result.targets["develop"]?.preset).toBe("server");
        expect(result.targets["serve"]?.preset).toBe("server");
    });

    it("should infer webpack build from webpack.config.js", () => {
        expect.assertions(2);

        writeFile("webpack.config.js", "module.exports = {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/legacy",
            projectRoot: tmp,
        });

        expect(result.targets["build"]?.command).toBe("webpack --mode=production");
        expect(result.targets["build"]?.outputs).toContain("{projectRoot}/dist");
    });

    it("should not infer webpack from a transitive dep alone", () => {
        expect.assertions(1);

        const result = inferProjectTargets({
            pkg: { devDependencies: { webpack: "^5.0.0" } },
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["build"]).toBeUndefined();
    });

    it("should infer prisma db:* targets from prisma/schema.prisma", () => {
        expect.assertions(4);

        writeFile("prisma/schema.prisma", 'generator client {\n  provider = "prisma-client-js"\n}\n');

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/api",
            projectRoot: tmp,
        });

        expect(result.targets["db:generate"]?.command).toBe("prisma generate");
        expect(result.targets["db:migrate"]?.command).toBe("prisma migrate dev");
        expect(result.targets["db:push"]?.command).toBe("prisma db push");
        expect(result.targets["db:studio"]?.preset).toBe("server");
    });

    it("should give prisma priority over drizzle on db:* targets", () => {
        expect.assertions(2);

        writeFile("prisma/schema.prisma", "generator client {}\n");
        writeFile("drizzle.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/api",
            projectRoot: tmp,
        });

        expect(result.targets["db:generate"]?.command).toBe("prisma generate");
        expect(result.targets["db:studio"]?.command).toBe("prisma studio");
    });

    it("should infer drizzle db:* targets from drizzle.config.ts", () => {
        expect.assertions(3);

        writeFile("drizzle.config.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/api",
            projectRoot: tmp,
        });

        expect(result.targets["db:generate"]?.command).toBe("drizzle-kit generate");
        expect(result.targets["db:migrate"]?.command).toBe("drizzle-kit migrate");
        expect(result.targets["db:studio"]?.command).toBe("drizzle-kit studio");
    });

    it("should infer graphql-codegen from codegen.ts", () => {
        expect.assertions(2);

        writeFile("codegen.ts", "export default {}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "apps/api",
            projectRoot: tmp,
        });

        expect(result.targets["codegen"]?.command).toBe("graphql-codegen");
        expect(result.targets["codegen"]?.outputs).toContain("{projectRoot}/src/generated");
    });

    it("should infer api-extractor from api-extractor.json", () => {
        expect.assertions(1);

        writeFile("api-extractor.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["api-extract"]?.command).toBe("api-extractor run --local");
    });

    it("should infer changeset:* targets from .changeset/config.json", () => {
        expect.assertions(3);

        writeFile(".changeset/config.json", "{}");

        const result = inferProjectTargets({
            pkg: {},
            projectDirectory: "packages/lib",
            projectRoot: tmp,
        });

        expect(result.targets["changeset:version"]?.command).toBe("changeset version");
        expect(result.targets["changeset:publish"]?.command).toBe("changeset publish");
        expect(result.targets["changeset:status"]?.command).toBe("changeset status");
    });
});
