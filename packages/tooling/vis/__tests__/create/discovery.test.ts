import { describe, expect, it } from "vitest";

import { discoverTemplate, expandCreateShorthand, parseGitHubUrl } from "../../src/commands/create/discovery";

describe("expandCreateShorthand", () => {
    it("should expand bare names to create-* packages", () => {
        expect.assertions(3);

        expect(expandCreateShorthand("vite")).toBe("create-vite");
        expect(expandCreateShorthand("vue")).toBe("create-vue");
        expect(expandCreateShorthand("next-app")).toBe("create-next-app");
    });

    it("should expand scoped names", () => {
        expect.assertions(1);

        expect(expandCreateShorthand("@scope/foo")).toBe("@scope/create-foo");
    });

    it("should not double-expand names already prefixed with create-", () => {
        expect.assertions(2);

        expect(expandCreateShorthand("create-vite")).toBe("create-vite");
        expect(expandCreateShorthand("@scope/create-foo")).toBe("@scope/create-foo");
    });
});

describe("parseGitHubUrl", () => {
    it("should parse full GitHub URLs", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("https://github.com/user/repo")).toBe("user/repo");
    });

    it("should parse GitHub URLs with branches", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("https://github.com/user/repo/tree/main")).toBe("user/repo#main");
    });

    it("should parse GitHub URLs with subdirectories", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("https://github.com/user/repo/tree/main/packages/cli")).toBe("user/repo/packages/cli#main");
    });

    it("should parse owner/repo shorthand", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("user/repo")).toBe("user/repo");
    });

    it("should parse owner/repo#branch shorthand", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("user/repo#dev")).toBe("user/repo#dev");
    });

    it("should return null for scoped npm packages", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("@scope/package")).toBeNull();
    });

    it("should return null for bare package names", () => {
        expect.assertions(1);

        expect(parseGitHubUrl("vite")).toBeNull();
    });
});

describe("discoverTemplate", () => {
    it("should resolve built-in vis:app template", () => {
        expect.assertions(2);

        const config = discoverTemplate("vis:app");

        expect(config.type).toBe("builtin:app");
        expect(config.source).toBe("vis:app");
    });

    it("should resolve built-in vis:monorepo template", () => {
        expect.assertions(1);

        expect(discoverTemplate("vis:monorepo").type).toBe("builtin:monorepo");
    });

    it("should resolve built-in vis:library template", () => {
        expect.assertions(1);

        expect(discoverTemplate("vis:library").type).toBe("builtin:library");
    });

    it("should resolve built-in aliases (vis:application → builtin:app)", () => {
        expect.assertions(1);

        expect(discoverTemplate("vis:application").type).toBe("builtin:app");
    });

    it("should resolve built-in aliases (vis:lib → builtin:library)", () => {
        expect.assertions(1);

        expect(discoverTemplate("vis:lib").type).toBe("builtin:library");
    });

    it("should be case-insensitive for built-in templates", () => {
        expect.assertions(1);

        expect(discoverTemplate("VIS:APP").type).toBe("builtin:app");
    });

    it("should resolve GitHub URLs as remote:github", () => {
        expect.assertions(2);

        const config = discoverTemplate("https://github.com/user/repo");

        expect(config.type).toBe("remote:github");
        expect(config.source).toBe("user/repo");
    });

    it("should resolve owner/repo shorthand as remote:github", () => {
        expect.assertions(2);

        const config = discoverTemplate("user/repo");

        expect(config.type).toBe("remote:github");
        expect(config.source).toBe("user/repo");
    });

    it("should resolve bare names as remote:npm with create- expansion", () => {
        expect.assertions(2);

        const config = discoverTemplate("vite");

        expect(config.type).toBe("remote:npm");
        expect(config.source).toBe("create-vite");
    });

    it("should resolve scoped packages as remote:npm", () => {
        expect.assertions(2);

        const config = discoverTemplate("@scope/foo");

        expect(config.type).toBe("remote:npm");
        expect(config.source).toBe("@scope/create-foo");
    });

    it("should forward extra args to config", () => {
        expect.assertions(1);

        const config = discoverTemplate("vite", ["--template", "react-ts"]);

        expect(config.args).toEqual(["--template", "react-ts"]);
    });
});
