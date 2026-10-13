import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OrgManifest } from "../../../src/commands/create/org-templates";
import { isOrgInput, orgTemplateConfig, parseOrgTemplates, resolveOrgTemplate } from "../../../src/commands/create/org-templates";
import { runTemplatePicker } from "../../../src/commands/create/prompts";
import { VisUserError } from "../../../src/errors/vis-user-error";

vi.mock(import("../../../src/util/catalog"), () => {
    return {
    // The real module loads a native binding; registry resolution is covered by catalog tests.
        getRegistryForPackage: (_name: string, config: { defaultRegistry: string }) => { return { token: undefined, url: config.defaultRegistry }; },
        loadNpmrc: () => { return { authTokens: new Map(), defaultRegistry: "https://registry.npmjs.org", registries: new Map() }; },
    };
});

vi.mock(import("../../../src/commands/create/prompts"), () => {
    return {
        runInteractivePrompts: vi.fn(),
        runTemplatePicker: vi.fn(),
    };
});

const validTemplates = [
    { description: "Web app", name: "app", source: { kind: "npm", package: "@vistest-org/create-app" } },
    { description: "Library", name: "lib", source: { kind: "git", url: "github:vistest-org/lib-template" } },
    { description: "Bundled", name: "bundled", source: { kind: "bundled", path: "templates/bundled" } },
];

/** Stub `fetch` to answer the `/latest` manifest request of `@vistest-org/create`. */
const stubRegistry = (response: { body?: unknown; status?: number; text?: string }): ReturnType<typeof vi.fn> => {
    const fetchMock = vi.fn(async () => {
        const status = response.status ?? 200;
        const text = response.text ?? JSON.stringify(response.body ?? {});

        return new Response(status === 404 ? null : text, { status });
    });

    vi.stubGlobal("fetch", fetchMock);

    return fetchMock;
};

const manifestPackage = (templates: unknown): { createConfig: { templates: unknown }; dist: { tarball: string } } => {
    return {
        createConfig: { templates },
        dist: { tarball: "https://registry.npmjs.org/@vistest-org/create/-/create-1.0.0.tgz" },
    };
};

describe(isOrgInput, () => {
    it("matches bare scopes and scope:name selectors only", () => {
        expect.assertions(5);

        expect(isOrgInput("@acme")).toBe(true);
        expect(isOrgInput("@acme:app")).toBe(true);
        expect(isOrgInput("@acme/create")).toBe(false);
        expect(isOrgInput("vite")).toBe(false);
        expect(isOrgInput("@Acme")).toBe(false);
    });
});

describe(parseOrgTemplates, () => {
    it("accepts the array and map forms", () => {
        expect.assertions(3);

        const fromArray = parseOrgTemplates(validTemplates);

        expect(fromArray.map((t) => t.name)).toStrictEqual(["app", "lib", "bundled"]);

        const fromMap = parseOrgTemplates({
            app: { description: "Web app", source: { kind: "npm", package: "@vistest-org/create-app" } },
        });

        expect(fromMap).toStrictEqual([{ description: "Web app", name: "app", source: { kind: "npm", package: "@vistest-org/create-app" } }]);
        expect(parseOrgTemplates([])).toStrictEqual([]);
    });

    it("rejects a non-collection manifest", () => {
        expect.assertions(2);

        expect(() => parseOrgTemplates("app")).toThrow(VisUserError);
        expect(() => parseOrgTemplates(null)).toThrow(VisUserError);
    });

    it.each([
        ["path separators", "../etc"],
        ["slash", "a/b"],
        ["backslash", String.raw`a\b`],
        ["vis: builtin namespace", "vis:app"],
        ["provider prefix", "github:x"],
        ["underscore sentinel", "__custom__"],
        ["leading dot", ".hidden"],
        ["leading dash", "-rf"],
        ["uppercase", "App"],
    ])("rejects a template name with %s", (_label, name) => {
        expect.assertions(1);

        expect(() => parseOrgTemplates([{ description: "x", name, source: { kind: "npm", package: "a" } }])).toThrow(/Invalid organization template manifest/);
    });

    it("rejects duplicate names and more than the entry cap", () => {
        expect.assertions(2);

        const entry = { description: "x", source: { kind: "npm", package: "a" } };

        expect(() => parseOrgTemplates([{ ...entry, name: "app" }, { ...entry, name: "app" }])).toThrow(/duplicate/);
        expect(() => parseOrgTemplates(Array.from({ length: 51 }, (_, index) => { return { ...entry, name: `t${String(index)}` }; }))).toThrow(
            /at most 50/,
        );
    });

    it("strips control characters from descriptions and caps their length", () => {
        expect.assertions(2);

        const [template] = parseOrgTemplates([
            { description: "\u001B[2Jevil\u009B", name: "app", source: { kind: "npm", package: "a" } },
        ]);

        expect(template?.description).toBe("[2Jevil");
        expect(() =>
            parseOrgTemplates([{ description: "x".repeat(201), name: "app", source: { kind: "npm", package: "a" } }]),
        ).toThrow(/descriptions must be/);
    });

    it.each([
        ["an unknown kind", { kind: "http", url: "https://example.com/t.tgz" }],
        ["a npm version spec", { kind: "npm", package: "@a/create-app@1.0.0" }],
        ["a npm flag", { kind: "npm", package: "--registry=evil" }],
        ["a raw git: clone", { kind: "git", url: "git:example.com/repo" }],
        ["a raw https tarball as git", { kind: "git", url: "https://example.com/t.tar.gz" }],
        ["a manifest-chosen gitlab host", { kind: "git", url: "gitlab://evil.example/x/y" }],
        ["a git url with whitespace", { kind: "git", url: "github:a/b --flag" }],
        ["a bundled absolute path", { kind: "bundled", path: "/etc/passwd" }],
        ["a bundled traversal", { kind: "bundled", path: "templates/../../secret" }],
        ["a bundled dot segment", { kind: "bundled", path: "./templates" }],
        ["a bundled backslash", { kind: "bundled", path: String.raw`templates\app` }],
        ["a bundled hidden segment", { kind: "bundled", path: "templates/.git" }],
        ["a missing source", undefined],
    ])("rejects %s", (_label, source) => {
        expect.assertions(1);

        expect(() => parseOrgTemplates([{ description: "x", name: "app", source }])).toThrow(VisUserError);
    });

    it("accepts a bundled path with plain segments and known git providers", () => {
        expect.assertions(2);

        const [bundled, git] = parseOrgTemplates([
            { description: "x", name: "bundled", source: { kind: "bundled", path: "templates/app-v2" } },
            { description: "x", name: "git", source: { kind: "git", url: "gitlab:group/sub/repo" } },
        ]);

        expect(bundled?.source).toStrictEqual({ kind: "bundled", path: "templates/app-v2" });
        expect(git?.source).toStrictEqual({ kind: "git", url: "gitlab:group/sub/repo" });
    });
});

describe(orgTemplateConfig, () => {
    const manifest: OrgManifest = { tarball: "https://registry.npmjs.org/@vistest-org/create/-/create-1.0.0.tgz", templates: [] };

    it("routes each source kind to its existing executor type", () => {
        expect.assertions(3);

        expect(orgTemplateConfig({ description: "x", name: "a", source: { kind: "npm", package: "@x/create-a" } }, manifest, ["--flag"])).toStrictEqual({
            args: ["--flag"],
            source: "@x/create-a",
            type: "remote:npm",
        });
        expect(orgTemplateConfig({ description: "x", name: "b", source: { kind: "git", url: "github:x/y" } }, manifest, []).type).toBe("remote:git");
        expect(orgTemplateConfig({ description: "x", name: "c", source: { kind: "bundled", path: "t/c" } }, manifest, [])).toStrictEqual({
            args: [],
            source: manifest.tarball,
            subdir: "t/c",
            type: "remote:bundled",
        });
    });

    it("refuses a bundled template when the package has no https tarball", () => {
        expect.assertions(1);

        expect(() =>
            orgTemplateConfig({ description: "x", name: "c", source: { kind: "bundled", path: "t/c" } }, { templates: [] }, []),
        ).toThrow(/dist.tarball/);
    });
});

describe(resolveOrgTemplate, () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-org-cwd-"));
        vi.mocked(runTemplatePicker).mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        rmSync(cwd, { force: true, recursive: true });
    });

    it("falls back to running @org/create as a create-* package when there is no manifest", async () => {
        expect.assertions(3);

        const fetchMock = stubRegistry({ status: 404 });
        const choice = await resolveOrgTemplate("@vistest-org", { args: ["--x"], cwd, interactive: true });

        expect(choice?.config).toStrictEqual({ args: ["--x"], source: "@vistest-org/create", type: "remote:npm" });
        expect(choice?.name).toBe("vistest-org");
        expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://registry.npmjs.org/@vistest-org%2Fcreate/latest");
    });

    it("falls back when the package has no createConfig.templates", async () => {
        expect.assertions(1);

        stubRegistry({ body: { createConfig: {}, name: "@vistest-org/create" } });

        const choice = await resolveOrgTemplate("@vistest-org", { args: [], cwd, interactive: false });

        expect(choice?.config.source).toBe("@vistest-org/create");
    });

    it("routes the picker choice through the template executor type", async () => {
        expect.assertions(3);

        stubRegistry({ body: manifestPackage(validTemplates) });
        vi.mocked(runTemplatePicker).mockResolvedValue("bundled");

        const choice = await resolveOrgTemplate("@vistest-org", { args: [], cwd, interactive: true });

        expect(runTemplatePicker).toHaveBeenCalledWith(
            "@vistest-org templates",
            expect.arrayContaining([expect.objectContaining({ label: "app", value: "app" })]),
        );
        expect(choice?.name).toBe("bundled");
        expect(choice?.config).toStrictEqual({
            args: [],
            source: "https://registry.npmjs.org/@vistest-org/create/-/create-1.0.0.tgz",
            subdir: "templates/bundled",
            type: "remote:bundled",
        });
    });

    it("selects an entry directly with @org:name without opening the picker", async () => {
        expect.assertions(2);

        stubRegistry({ body: manifestPackage(validTemplates) });

        const choice = await resolveOrgTemplate("@vistest-org:lib", { args: [], cwd, interactive: false });

        expect(choice?.config).toStrictEqual({ args: [], source: "github:vistest-org/lib-template", type: "remote:git" });
        expect(runTemplatePicker).not.toHaveBeenCalled();
    });

    it("refuses to pick without a terminal and lists the templates", async () => {
        expect.assertions(2);

        stubRegistry({ body: manifestPackage(validTemplates) });

        await expect(resolveOrgTemplate("@vistest-org", { args: [], cwd, interactive: false })).rejects.toThrow(/vis create @vistest-org:<name>/);
        expect(runTemplatePicker).not.toHaveBeenCalled();
    });

    it("prints the manifest and returns nothing for --list", async () => {
        expect.assertions(2);

        stubRegistry({ body: manifestPackage(validTemplates) });

        await expect(resolveOrgTemplate("@vistest-org", { args: [], cwd, interactive: true, list: true })).resolves.toBeUndefined();
        expect(runTemplatePicker).not.toHaveBeenCalled();
    });

    it("rejects an unknown or unresolvable selector", async () => {
        expect.assertions(2);

        stubRegistry({ body: manifestPackage(validTemplates) });

        await expect(resolveOrgTemplate("@vistest-org:nope", { args: [], cwd, interactive: false })).rejects.toThrow(/no template "nope"/);

        stubRegistry({ status: 404 });

        await expect(resolveOrgTemplate("@vistest-org:app", { args: [], cwd, interactive: false })).rejects.toThrow(/no createConfig/);
    });

    it("fails closed on a malformed manifest instead of falling back", async () => {
        expect.assertions(2);

        stubRegistry({ body: manifestPackage([{ description: "x", name: "../evil", source: { kind: "npm", package: "a" } }]) });

        await expect(resolveOrgTemplate("@vistest-org", { args: [], cwd, interactive: true })).rejects.toThrow(VisUserError);
        expect(runTemplatePicker).not.toHaveBeenCalled();
    });

    it("rejects an oversized manifest response", async () => {
        expect.assertions(1);

        stubRegistry({ text: `{"createConfig":{"templates":"${"x".repeat(300_000)}"}}` });

        await expect(resolveOrgTemplate("@vistest-org", { args: [], cwd, interactive: true })).rejects.toThrow(/too large/);
    });
});
