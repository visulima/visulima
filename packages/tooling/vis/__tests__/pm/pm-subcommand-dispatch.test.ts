import { describe, expect, it } from "vitest";

import { dispatchSubcommand } from "../../src/pm/pm-subcommand-dispatch";

const npm = { name: "npm" as const, version: "10.5.0" };
const pnpm10 = { name: "pnpm" as const, version: "10.14.0" };
const pnpm11 = { name: "pnpm" as const, version: "11.0.0" };
const yarn1 = { name: "yarn" as const, version: "1.22.19" };
const yarn4 = { name: "yarn" as const, version: "4.1.0" };
const bun = { name: "bun" as const, version: "1.3.0" };
const deno = { name: "deno" as const, version: "2.0.0" };

describe(dispatchSubcommand, () => {
    describe("plugin", () => {
        it("passes through for yarn berry", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "plugin", ["list"])).toStrictEqual({ kind: "passthrough" });
        });

        it("skips with warning for yarn 1", () => {
            expect.assertions(1);

            const action = dispatchSubcommand(yarn1, "plugin", ["list"]);

            expect(action).toMatchObject({
                kind: "skip",
                warning: expect.stringMatching(/yarn-style plugins/),
            });
        });

        it.each([
            ["npm", npm],
            ["pnpm", pnpm10],
            ["bun", bun],
            ["deno", deno],
        ])("skips with warning for %s", (_name, pm) => {
            expect.assertions(1);

            const action = dispatchSubcommand(pm, "plugin", ["list"]);

            expect(action.kind).toBe("skip");
        });
    });

    describe("whoami", () => {
        it("passes through for npm and pnpm <11", () => {
            expect.assertions(2);
            expect(dispatchSubcommand(npm, "whoami", [])).toStrictEqual({ kind: "passthrough" });
            expect(dispatchSubcommand(pnpm10, "whoami", [])).toStrictEqual({ kind: "passthrough" });
        });

        it("rewrites pnpm 11+ to `npm whoami` with a warning", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(pnpm11, "whoami", [])).toStrictEqual({
                args: ["whoami"],
                bin: "npm",
                kind: "rewrite",
                warning: expect.stringMatching(/pnpm 11 removed `whoami`/),
            });
        });

        it("rewrites yarn berry to `yarn npm whoami`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "whoami", [])).toStrictEqual({
                args: ["npm", "whoami"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it("rewrites bun to `bun pm whoami`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(bun, "whoami", [])).toStrictEqual({
                args: ["pm", "whoami"],
                bin: "bun",
                kind: "rewrite",
            });
        });

        it("skips with warning for deno", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(deno, "whoami", []).kind).toBe("skip");
        });

        it("passes through for yarn 1", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn1, "whoami", [])).toStrictEqual({ kind: "passthrough" });
        });
    });

    describe("login / logout", () => {
        it.each(["login", "logout"] as const)("rewrites yarn berry %s to `yarn npm <sub>`", (sub) => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, sub, ["--registry=https://r"])).toStrictEqual({
                args: ["npm", sub, "--registry=https://r"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it.each(["login", "logout"] as const)("rewrites bun %s to `npm <sub>` with a warning", (sub) => {
            expect.assertions(1);

            const action = dispatchSubcommand(bun, sub, []);

            // Single matcher checks rewrite shape AND that the warning mentions
            // both `bun has no` and the `.npmrc` fallback.
            expect(action).toStrictEqual({
                args: [sub],
                bin: "npm",
                kind: "rewrite",
                warning: expect.stringMatching(/bun has no.*\.npmrc/s),
            });
        });

        it("skips deno login with browser-auth note", () => {
            expect.assertions(1);

            const action = dispatchSubcommand(deno, "login", []);

            expect(action).toMatchObject({
                kind: "skip",
                warning: expect.stringMatching(/browser OAuth/),
            });
        });

        it.each([
            ["npm", npm],
            ["pnpm 10", pnpm10],
            ["pnpm 11", pnpm11],
            ["yarn 1", yarn1],
        ])("passes through %s login (native command exists)", (_name, pm) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pm, "login", [])).toStrictEqual({ kind: "passthrough" });
        });
    });

    describe("owner", () => {
        it("rewrites pnpm 11 to `npm owner`", () => {
            expect.assertions(1);

            const action = dispatchSubcommand(pnpm11, "owner", ["ls", "react"]);

            expect(action).toStrictEqual({
                args: ["owner", "ls", "react"],
                bin: "npm",
                kind: "rewrite",
                warning: expect.stringMatching(/pnpm 11 removed `owner`/),
            });
        });

        it("rewrites yarn berry to `npm owner`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "owner", ["ls"])).toMatchObject({ args: ["owner", "ls"], bin: "npm", kind: "rewrite" });
        });

        it("passes through pnpm 10 and yarn 1 (both have native owner)", () => {
            expect.assertions(2);
            expect(dispatchSubcommand(pnpm10, "owner", []).kind).toBe("passthrough");
            expect(dispatchSubcommand(yarn1, "owner", []).kind).toBe("passthrough");
        });

        it("skips deno owner", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(deno, "owner", []).kind).toBe("skip");
        });
    });

    describe("dist-tag", () => {
        it("rewrites yarn 1 to `yarn tag`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn1, "dist-tag", ["add", "pkg@1.0.0", "next"])).toMatchObject({
                args: ["tag", "add", "pkg@1.0.0", "next"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it("rewrites yarn berry to `yarn npm tag` and translates rm → remove", () => {
            expect.assertions(2);
            expect(dispatchSubcommand(yarn4, "dist-tag", ["rm", "pkg", "old"])).toStrictEqual({
                args: ["npm", "tag", "remove", "pkg", "old"],
                bin: "yarn",
                kind: "rewrite",
            });
            expect(dispatchSubcommand(yarn4, "dist-tag", ["add", "pkg@1.0.0", "next"])).toStrictEqual({
                args: ["npm", "tag", "add", "pkg@1.0.0", "next"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it("preserves `rm` for yarn 1 (yarn tag uses `rm`, not `remove`)", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn1, "dist-tag", ["rm", "pkg", "old"])).toMatchObject({
                args: ["tag", "rm", "pkg", "old"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it("passes through for npm and pnpm (both have native dist-tag)", () => {
            expect.assertions(3);
            expect(dispatchSubcommand(npm, "dist-tag", []).kind).toBe("passthrough");
            expect(dispatchSubcommand(pnpm10, "dist-tag", []).kind).toBe("passthrough");
            expect(dispatchSubcommand(pnpm11, "dist-tag", []).kind).toBe("passthrough");
        });

        it("skips bun and deno", () => {
            expect.assertions(2);
            expect(dispatchSubcommand(bun, "dist-tag", []).kind).toBe("skip");
            expect(dispatchSubcommand(deno, "dist-tag", []).kind).toBe("skip");
        });
    });

    describe("audit / publish", () => {
        it("rewrites yarn berry audit to `yarn npm audit`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "audit", ["--json"])).toStrictEqual({
                args: ["npm", "audit", "--json"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it("rewrites yarn berry publish to `yarn npm publish`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "publish", ["--access", "public"])).toStrictEqual({
                args: ["npm", "publish", "--access", "public"],
                bin: "yarn",
                kind: "rewrite",
            });
        });

        it.each([
            ["npm", npm],
            ["pnpm 10", pnpm10],
            ["pnpm 11", pnpm11],
            ["yarn 1", yarn1],
            ["bun", bun],
            ["deno", deno],
        ])("passes through audit for %s", (_name, pm) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pm, "audit", []).kind).toBe("passthrough");
        });
    });

    describe("config", () => {
        it("rewrites yarn berry `config delete` to `config unset`", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "config", ["delete", "registry"])).toStrictEqual({
                args: ["config", "unset", "registry"],
                bin: "yarn",
                kind: "rewrite",
                warning: expect.stringMatching(/config unset/),
            });
        });

        it("passes through yarn berry `config get` / `config set`", () => {
            expect.assertions(2);
            expect(dispatchSubcommand(yarn4, "config", ["get", "registry"]).kind).toBe("passthrough");
            expect(dispatchSubcommand(yarn4, "config", ["set", "registry", "https://r"]).kind).toBe("passthrough");
        });

        it("skips bun and deno", () => {
            expect.assertions(2);
            expect(dispatchSubcommand(bun, "config", ["get", "x"]).kind).toBe("skip");
            expect(dispatchSubcommand(deno, "config", ["get", "x"]).kind).toBe("skip");
        });

        it("passes through npm/pnpm/yarn1 config", () => {
            expect.assertions(3);
            expect(dispatchSubcommand(npm, "config", ["get", "x"]).kind).toBe("passthrough");
            expect(dispatchSubcommand(pnpm10, "config", ["get", "x"]).kind).toBe("passthrough");
            expect(dispatchSubcommand(yarn1, "config", ["get", "x"]).kind).toBe("passthrough");
        });
    });

    describe("prune / rebuild", () => {
        it.each([
            ["yarn 1", yarn1],
            ["yarn 4", yarn4],
            ["bun", bun],
            ["deno", deno],
        ])("skips prune for %s", (_name, pm) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pm, "prune", []).kind).toBe("skip");
        });

        it.each([
            ["yarn 1", yarn1],
            ["bun", bun],
            ["deno", deno],
        ])("skips rebuild for %s", (_name, pm) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pm, "rebuild", []).kind).toBe("skip");
        });

        it("passes through prune/rebuild for npm and pnpm", () => {
            expect.assertions(4);
            expect(dispatchSubcommand(npm, "prune", []).kind).toBe("passthrough");
            expect(dispatchSubcommand(pnpm10, "prune", []).kind).toBe("passthrough");
            expect(dispatchSubcommand(npm, "rebuild", []).kind).toBe("passthrough");
            expect(dispatchSubcommand(pnpm10, "rebuild", []).kind).toBe("passthrough");
        });

        it("passes through rebuild for yarn berry (yarn rebuild exists)", () => {
            expect.assertions(1);
            expect(dispatchSubcommand(yarn4, "rebuild", []).kind).toBe("passthrough");
        });
    });

    describe("pnpm 11 removals (search / token / ping)", () => {
        it.each(["search", "token", "ping"] as const)("rewrites pnpm 11 %s to `npm <sub>`", (sub) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pnpm11, sub, ["x"])).toStrictEqual({
                args: [sub, "x"],
                bin: "npm",
                kind: "rewrite",
                warning: expect.stringMatching(new RegExp(`pnpm 11 removed \`${sub}\``)),
            });
        });

        it.each(["search", "token", "ping"] as const)("passes through pnpm 10 %s (native resolver routes to npm)", (sub) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pnpm10, sub, []).kind).toBe("passthrough");
        });
    });

    describe("default passthrough", () => {
        it.each([
            ["install", npm],
            ["add", pnpm10],
            ["remove", yarn4],
            ["update", bun],
            ["cache", pnpm10],
            ["view", yarn4],
            ["pack", bun],
            ["list", npm],
            ["dlx", pnpm10],
            ["why", yarn4],
            ["fund", npm],
            ["deprecate", npm],
            ["unknown-future-thing", npm],
        ] as const)("passes through `%s` for %s (native or always-npm path)", (sub, pm) => {
            expect.assertions(1);
            expect(dispatchSubcommand(pm, sub, []).kind).toBe("passthrough");
        });
    });

    describe("pnpm version detection", () => {
        it("treats pnpm 'latest' as not 11+ (no removal applies)", () => {
            expect.assertions(1);
            expect(dispatchSubcommand({ name: "pnpm", version: "latest" }, "whoami", []).kind).toBe("passthrough");
        });

        it("treats pnpm 11.5.2 as 11+", () => {
            expect.assertions(1);
            expect(dispatchSubcommand({ name: "pnpm", version: "11.5.2" }, "whoami", []).kind).toBe("rewrite");
        });

        it("treats pnpm 12 as 11+", () => {
            expect.assertions(1);
            expect(dispatchSubcommand({ name: "pnpm", version: "12.0.0" }, "whoami", []).kind).toBe("rewrite");
        });
    });
});
