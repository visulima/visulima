import { describe, expect, it } from "vitest";

import type { RestrictedProject } from "../../src/util/write-guard";
import { buildWriteGuardArtifacts, renderGithubWriteGuard, renderGitlabWriteGuard } from "../../src/util/write-guard";

const projects: RestrictedProject[] = [
    { name: "@scope/b", root: "packages/b" },
    { name: "@scope/a", root: "packages/a" },
];

describe(renderGithubWriteGuard, () => {
    it("emits a pull_request workflow scoped to restricted roots, sorted by name", () => {
        expect.assertions(4);

        const yaml = renderGithubWriteGuard(projects);

        expect(yaml).toContain("uses: geritol/write-guard@v1");
        expect(yaml).toContain("on:\n  pull_request:\n    paths:\n      - \"packages/a/**\"\n      - \"packages/b/**\"");
        // @scope/a sorts before @scope/b
        expect(yaml.indexOf("packages/a/**")).toBeLessThan(yaml.indexOf("packages/b/**"));
        expect(yaml).toContain("Do not edit by hand.");
    });

    it("maps a root-level project ('.') to a recursive '**' glob", () => {
        expect.assertions(1);

        expect(renderGithubWriteGuard([{ name: "root", root: "." }])).toContain("      - \"**\"");
    });
});

describe(renderGitlabWriteGuard, () => {
    it("emits an includable merge-request job gated on restricted changes", () => {
        expect.assertions(3);

        const yaml = renderGitlabWriteGuard(projects);

        expect(yaml).toContain("if: '$CI_PIPELINE_SOURCE == \"merge_request_event\"'");
        expect(yaml).toContain("- \"packages/a/**/*\"");
        expect(yaml).toContain("pnpm vis sync codeowners --check");
    });

    it("loudly documents that it is a soft guard needing the native GitLab setting", () => {
        expect.assertions(4);

        const yaml = renderGitlabWriteGuard(projects);

        // The asymmetry with the GitHub hard gate must be unmissable:
        // stated in the file header comment AND the job log output.
        expect(yaml).toContain("SOFT GUARD ONLY");
        expect(yaml).toContain("Require approval from Code Owners");
        expect(yaml).toContain("https://docs.gitlab.com/ee/user/project/codeowners/");
        expect(yaml).toContain("This job does NOT enforce");
    });
});

describe(buildWriteGuardArtifacts, () => {
    it("returns both forge artefacts at their conventional paths", () => {
        expect.assertions(3);

        const artifacts = buildWriteGuardArtifacts(projects);

        expect(artifacts).toHaveLength(2);
        expect(artifacts.map((a) => a.path)).toStrictEqual([".github/workflows/write-guard.yml", ".gitlab/write-guard.gitlab-ci.yml"]);
        expect(artifacts[0]?.content).toContain("geritol/write-guard@v1");
    });

    it("returns nothing when no project is restricted", () => {
        expect.assertions(1);

        expect(buildWriteGuardArtifacts([])).toStrictEqual([]);
    });

    it("deduplicates projects that share a root", () => {
        expect.assertions(1);

        const yaml = renderGithubWriteGuard([
            { name: "@scope/a", root: "packages/shared" },
            { name: "@scope/b", root: "packages/shared" },
        ]);

        expect(yaml.match(/packages\/shared\/\*\*/gu)).toHaveLength(2);
    });
});
