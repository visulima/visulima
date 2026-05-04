import { describe, expect, it } from "vitest";

import { discoverTemplate, expandCreateShorthand, inferParentDir, isGitUrl } from "../../../src/commands/create/discovery";

describe(expandCreateShorthand, () => {
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

    it("should return bare @scope without slash as-is", () => {
        expect.assertions(1);

        expect(expandCreateShorthand("@scope")).toBe("@scope");
    });

    it("should preserve direct-package initializers like sv", () => {
        expect.assertions(1);

        expect(expandCreateShorthand("sv")).toBe("sv");
    });
});

describe(isGitUrl, () => {
    it("should recognize GitHub HTTPS URLs", () => {
        expect.assertions(1);

        expect(isGitUrl("https://github.com/user/repo")).toBe(true);
    });

    it("should recognize GitLab HTTPS URLs", () => {
        expect.assertions(1);

        expect(isGitUrl("https://gitlab.com/user/repo")).toBe(true);
    });

    it("should recognize Bitbucket HTTPS URLs", () => {
        expect.assertions(1);

        expect(isGitUrl("https://bitbucket.org/user/repo")).toBe(true);
    });

    it("should recognize SSH URLs", () => {
        expect.assertions(3);

        expect(isGitUrl("git@github.com:user/repo")).toBe(true);
        expect(isGitUrl("git@gitlab.com:user/repo")).toBe(true);
        expect(isGitUrl("git@bitbucket.org:user/repo")).toBe(true);
    });

    it("should recognize platform prefix shorthands", () => {
        expect.assertions(6);

        expect(isGitUrl("github:user/repo")).toBe(true);
        expect(isGitUrl("gh:user/repo")).toBe(true);
        expect(isGitUrl("gitlab:user/repo")).toBe(true);
        expect(isGitUrl("bitbucket:user/repo")).toBe(true);
        expect(isGitUrl("sourcehut:user/repo")).toBe(true);
        expect(isGitUrl("git:user/repo")).toBe(true);
    });

    it("should recognize Sourcehut URLs", () => {
        expect.assertions(1);

        expect(isGitUrl("https://git.sr.ht/~user/repo")).toBe(true);
    });

    it("should recognize direct tarball/registry URLs (giget http/https provider)", () => {
        expect.assertions(2);

        expect(isGitUrl("https://example.com/templates/my-template.tar.gz")).toBe(true);
        expect(isGitUrl("http://internal.corp/archive/template.tar.gz")).toBe(true);
    });

    it("should recognize owner/repo shorthand", () => {
        expect.assertions(1);

        expect(isGitUrl("user/repo")).toBe(true);
    });

    it("should NOT recognize scoped npm packages", () => {
        expect.assertions(1);

        expect(isGitUrl("@scope/package")).toBe(false);
    });

    it("should NOT recognize bare package names", () => {
        expect.assertions(1);

        expect(isGitUrl("vite")).toBe(false);
    });

    it("should NOT recognize create-* packages", () => {
        expect.assertions(1);

        expect(isGitUrl("create-vite")).toBe(false);
    });
});

describe(discoverTemplate, () => {
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

    it("should resolve GitHub URLs as remote:git", () => {
        expect.assertions(2);

        const config = discoverTemplate("https://github.com/user/repo");

        expect(config.type).toBe("remote:git");
        expect(config.source).toBe("https://github.com/user/repo");
    });

    it("should resolve GitLab URLs as remote:git", () => {
        expect.assertions(2);

        const config = discoverTemplate("https://gitlab.com/user/repo");

        expect(config.type).toBe("remote:git");
        expect(config.source).toBe("https://gitlab.com/user/repo");
    });

    it("should resolve Bitbucket URLs as remote:git", () => {
        expect.assertions(2);

        const config = discoverTemplate("https://bitbucket.org/user/repo");

        expect(config.type).toBe("remote:git");
        expect(config.source).toBe("https://bitbucket.org/user/repo");
    });

    it("should resolve owner/repo shorthand as remote:git", () => {
        expect.assertions(2);

        const config = discoverTemplate("user/repo");

        expect(config.type).toBe("remote:git");
        expect(config.source).toBe("user/repo");
    });

    it("should resolve platform prefix shorthands as remote:git", () => {
        expect.assertions(6);

        expect(discoverTemplate("github:user/repo").type).toBe("remote:git");
        expect(discoverTemplate("gh:user/repo").type).toBe("remote:git");
        expect(discoverTemplate("gitlab:user/repo").type).toBe("remote:git");
        expect(discoverTemplate("bitbucket:user/repo").type).toBe("remote:git");
        expect(discoverTemplate("sourcehut:user/repo").type).toBe("remote:git");
        expect(discoverTemplate("git:user/repo").type).toBe("remote:git");
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

    it("should resolve built-in vis:generator template", () => {
        expect.assertions(1);

        expect(discoverTemplate("vis:generator").type).toBe("builtin:generator");
    });

    it("should throw on empty string input", () => {
        expect.assertions(1);

        expect(() => discoverTemplate("")).toThrow("No template specified.");
    });

    it("should forward extra args to config", () => {
        expect.assertions(1);

        const config = discoverTemplate("vite", ["--template", "react-ts"]);

        expect(config.args).toEqual(["--template", "react-ts"]);
    });

    it("should preserve full URL as source for giget to parse", () => {
        expect.assertions(1);

        const config = discoverTemplate("https://github.com/user/repo/tree/main/packages/cli");

        expect(config.source).toBe("https://github.com/user/repo/tree/main/packages/cli");
    });
});

describe(inferParentDir, () => {
    it("should return 'apps' for builtin:app", () => {
        expect.assertions(1);

        expect(inferParentDir("builtin:app")).toBe("apps");
    });

    it("should return 'packages' for builtin:library", () => {
        expect.assertions(1);

        expect(inferParentDir("builtin:library")).toBe("packages");
    });

    it("should return 'packages' for builtin:generator", () => {
        expect.assertions(1);

        expect(inferParentDir("builtin:generator")).toBe("packages");
    });

    it("should return '.' for remote types and monorepo", () => {
        expect.assertions(3);

        expect(inferParentDir("remote:npm")).toBe(".");
        expect(inferParentDir("remote:git")).toBe(".");
        expect(inferParentDir("builtin:monorepo")).toBe(".");
    });
});
