import { describe, expect, it } from "vitest";

import type { CommandRunner } from "../../../src/release/core/package-managers/interface";
import { checkGithubPushRules } from "../../../src/release/core/remote/github-push-rules";

type Routes = Record<string, unknown>;

/** Fake `gh` answering `gh api &lt;path>` from `routes`; a missing route is a 404. */
const createGh = (routes: Routes): { paths: string[]; runner: CommandRunner; tokens: (string | undefined)[] } => {
    const paths: string[] = [];
    const tokens: (string | undefined)[] = [];

    const runner: CommandRunner = {
        run: async (_command, args, options) => {
            const path = args.at(-1) ?? "";

            paths.push(path);
            tokens.push(options.env?.["GH_TOKEN"]);

            if (!(path in routes)) {
                return { exitCode: 1, stderr: "gh: Not Found (HTTP 404)", stdout: "" };
            }

            return { exitCode: 0, stderr: "", stdout: JSON.stringify(routes[path]) };
        },
    };

    return { paths, runner, tokens };
};

const base = {
    createdTags: [] as string[],
    cwd: "/r",
    repo: "acme/repo",
    signedCommits: false,
    updatedTags: [] as string[],
};

const tagRuleset = (overrides: Record<string, unknown> = {}): Record<string, unknown> => {
    return {
        conditions: { ref_name: { exclude: [], include: ["refs/tags/v*"] } },
        current_user_can_bypass: "never",
        enforcement: "active",
        id: 7,
        name: "release tags",
        rules: [{ type: "creation" }],
        target: "tag",
        ...overrides,
    };
};

describe("checkGithubPushRules: tags", () => {
    it("blocks a planned tag whose creation a tag ruleset restricts", async () => {
        expect.hasAssertions();

        const { runner } = createGh({
            "repos/acme/repo/rulesets/7": tagRuleset(),
            "repos/acme/repo/rulesets?includes_parents=true&per_page=100": [{ enforcement: "active", id: 7, target: "tag" }],
        });

        const result = await checkGithubPushRules(runner, { ...base, createdTags: ["v1.2.3", "other-1.0.0"] });

        expect(result.blocked).toStrictEqual(["tag v1.2.3: ruleset \"release tags\" restricts tag creation"]);
        expect(result.warnings).toStrictEqual([]);
    });

    it.each([
        ["the token can always bypass", { current_user_can_bypass: "always" }],
        ["the token is exempt", { current_user_can_bypass: "exempt" }],
        ["the tag is excluded", { conditions: { ref_name: { exclude: ["refs/tags/v1.*"], include: ["~ALL"] } } }],
        ["the ruleset only restricts deletion", { rules: [{ type: "deletion" }] }],
    ])("does not block when %s", async (_label, overrides) => {
        expect.hasAssertions();

        const { runner } = createGh({
            "repos/acme/repo/rulesets/7": tagRuleset(overrides),
            "repos/acme/repo/rulesets?includes_parents=true&per_page=100": [{ enforcement: "active", id: 7, target: "tag" }],
        });

        await expect(checkGithubPushRules(runner, { ...base, createdTags: ["v1.2.3"] })).resolves.toStrictEqual({ blocked: [], warnings: [] });
    });

    it("ignores evaluate-mode and branch rulesets", async () => {
        expect.hasAssertions();

        const { paths, runner } = createGh({
            "repos/acme/repo/rulesets?includes_parents=true&per_page=100": [
                { enforcement: "evaluate", id: 7, target: "tag" },
                { enforcement: "active", id: 8, target: "branch" },
            ],
        });

        await expect(checkGithubPushRules(runner, { ...base, createdTags: ["v1.2.3"] })).resolves.toStrictEqual({ blocked: [], warnings: [] });
        expect(paths).not.toContain("repos/acme/repo/rulesets/7");
    });

    it("only warns when a floating major tag update is restricted", async () => {
        expect.hasAssertions();

        const { runner } = createGh({
            "repos/acme/repo/rulesets/7": tagRuleset({ conditions: { ref_name: { include: ["~ALL"] } }, rules: [{ type: "update" }] }),
            "repos/acme/repo/rulesets?includes_parents=true&per_page=100": [{ enforcement: "active", id: 7, target: "tag" }],
        });

        const result = await checkGithubPushRules(runner, { ...base, createdTags: ["acme-cli@1.2.3"], updatedTags: ["acme-cli-v1"] });

        expect(result.blocked).toStrictEqual([]);
        expect(result.warnings).toStrictEqual(["tag acme-cli-v1: ruleset \"release tags\" restricts tag updates — the floating major tag will not move"]);
    });

    it("fails open with a warning when rulesets can't be read", async () => {
        expect.hasAssertions();

        const { runner } = createGh({});

        const result = await checkGithubPushRules(runner, { ...base, createdTags: ["v1.2.3"] });

        expect(result.blocked).toStrictEqual([]);
        expect(result.warnings).toStrictEqual(["could not check tag rulesets: gh: Not Found (HTTP 404)"]);
    });

    it("asks gh with the env it was given (the push token)", async () => {
        expect.hasAssertions();

        const { runner, tokens } = createGh({ "repos/acme/repo/rulesets?includes_parents=true&per_page=100": [] });

        await checkGithubPushRules(runner, { ...base, createdTags: ["v1"], env: { GH_TOKEN: "push-token" } });

        expect(tokens).toStrictEqual(["push-token"]);
    });
});

describe("checkGithubPushRules: branch", () => {
    it("warns when a ruleset requires pull requests on the release branch", async () => {
        expect.hasAssertions();

        const { runner } = createGh({
            "repos/acme/repo/branches/main": { protected: false },
            "repos/acme/repo/rules/branches/main": [
                { ruleset_id: 3, type: "pull_request" },
                { ruleset_id: 3, type: "deletion" },
            ],
            "repos/acme/repo/rulesets/3": { current_user_can_bypass: "never", id: 3, name: "main" },
        });

        const result = await checkGithubPushRules(runner, { ...base, branch: "main" });

        expect(result.blocked).toStrictEqual([]);
        expect(result.warnings).toStrictEqual([
            "branch main: ruleset \"main\" requires pull_request — release commits (lock, registry, changelog) will not be pushed",
        ]);
    });

    it("treats required signatures as blocking only for unsigned commits", async () => {
        expect.hasAssertions();

        const routes = {
            "repos/acme/repo/branches/main": { protected: false },
            "repos/acme/repo/rules/branches/main": [{ ruleset_id: 3, type: "required_signatures" }],
            "repos/acme/repo/rulesets/3": { current_user_can_bypass: "never", id: 3, name: "main" },
        };

        const unsigned = await checkGithubPushRules(createGh(routes).runner, { ...base, branch: "main" });
        const signed = await checkGithubPushRules(createGh(routes).runner, { ...base, branch: "main", signedCommits: true });

        expect(unsigned.warnings).toHaveLength(1);
        expect(signed.warnings).toStrictEqual([]);
    });

    it("url-encodes the branch name", async () => {
        expect.hasAssertions();

        const { paths, runner } = createGh({
            "repos/acme/repo/branches/release%2F1.x": { protected: false },
            "repos/acme/repo/rules/branches/release%2F1.x": [],
        });

        await expect(checkGithubPushRules(runner, { ...base, branch: "release/1.x" })).resolves.toStrictEqual({ blocked: [], warnings: [] });
        expect(paths).toContain("repos/acme/repo/rules/branches/release%2F1.x");
    });

    it("warns when classic protection is on but unreadable with this token", async () => {
        expect.hasAssertions();

        const { runner } = createGh({
            "repos/acme/repo/branches/main": { protected: true },
            "repos/acme/repo/rules/branches/main": [],
        });

        const result = await checkGithubPushRules(runner, { ...base, branch: "main" });

        expect(result.warnings).toStrictEqual([
            "branch main: classic branch protection is enabled and this token can't read it — release commits may be rejected",
        ]);
    });

    it.each([
        [
            "enforced for admins",
            true,
            ["branch main: classic branch protection requires pull requests or status checks, enforced for admins — release commits will not be pushed"],
        ],
        ["not enforced for admins (the admin token bypasses it)", false, []],
    ])("classic protection requiring reviews, %s", async (_label, enforceAdmins, warnings) => {
        expect.hasAssertions();

        const { runner } = createGh({
            "repos/acme/repo/branches/main": { protected: true },
            "repos/acme/repo/branches/main/protection": { enforce_admins: { enabled: enforceAdmins }, required_pull_request_reviews: {} },
            "repos/acme/repo/rules/branches/main": [],
        });

        await expect(checkGithubPushRules(runner, { ...base, branch: "main" })).resolves.toStrictEqual({ blocked: [], warnings });
    });
});
