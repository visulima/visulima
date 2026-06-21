import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logCommandOutputCI, resolveCiGroupingMode } from "../../src/tui/status-utils";

const CI_ENV_KEYS = ["BUILDKITE", "GITHUB_ACTIONS", "GITLAB_CI", "TF_BUILD"] as const;

const clearCiEnv = (): void => {
    for (const key of CI_ENV_KEYS) {
        Reflect.deleteProperty(process.env, key);
    }
};

describe(resolveCiGroupingMode, () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        clearCiEnv();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("returns 'off' when no CI runner is detected and mode is auto", () => {
        expect.assertions(1);
        expect(resolveCiGroupingMode("auto")).toBe("off");
    });

    it("returns 'github' when GITHUB_ACTIONS=true and mode is auto", () => {
        expect.assertions(1);

        process.env["GITHUB_ACTIONS"] = "true";

        expect(resolveCiGroupingMode("auto")).toBe("github");
    });

    it("returns 'gitlab' when GITLAB_CI=true and mode is auto", () => {
        expect.assertions(1);

        process.env["GITLAB_CI"] = "true";

        expect(resolveCiGroupingMode("auto")).toBe("gitlab");
    });

    it("returns 'buildkite' when BUILDKITE=true and mode is auto", () => {
        expect.assertions(1);

        process.env["BUILDKITE"] = "true";

        expect(resolveCiGroupingMode("auto")).toBe("buildkite");
    });

    it("returns 'azure' when TF_BUILD=True (Pascal-case) and mode is auto", () => {
        expect.assertions(2);

        process.env["TF_BUILD"] = "True";

        expect(resolveCiGroupingMode("auto")).toBe("azure");

        process.env["TF_BUILD"] = "true";

        expect(resolveCiGroupingMode("auto")).toBe("azure");
    });

    it("honors explicit overrides regardless of env", () => {
        expect.assertions(4);

        process.env["GITHUB_ACTIONS"] = "true";

        expect(resolveCiGroupingMode("gitlab")).toBe("gitlab");
        expect(resolveCiGroupingMode("off")).toBe("off");
        expect(resolveCiGroupingMode("buildkite")).toBe("buildkite");
        expect(resolveCiGroupingMode("azure")).toBe("azure");
    });

    it("treats undefined as auto", () => {
        expect.assertions(1);

        process.env["GITHUB_ACTIONS"] = "true";

        expect(resolveCiGroupingMode(undefined)).toBe("github");
    });
});

describe(logCommandOutputCI, () => {
    let writes: string[];
    const originalEnv = { ...process.env };

    beforeEach(() => {
        writes = [];
        clearCiEnv();
        vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
            writes.push(typeof chunk === "string" ? chunk : String(chunk));

            return true;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env = { ...originalEnv };
    });

    it("emits GitHub ::group:: directives when grouping is github", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "success", "hello", "github");

        const joined = writes.join("");

        expect(joined).toContain("::group::");
        expect(joined).toContain("::endgroup::");
    });

    it("emits GitLab section_start ANSI directives with the ESC erase-line prefix", () => {
        expect.assertions(4);

        logCommandOutputCI("app:test", "success", "hello", "gitlab");

        const joined = writes.join("");

        // section keys must be sanitized — colons aren't allowed
        expect(joined).toContain("section_start:");
        expect(joined).toContain("app_test");
        // The CSI "Erase In Line" prefix (ESC + "[0K") must be emitted
        // verbatim or GitLab won't strip the directive line from the UI.
        expect(joined).toContain("[0K");
        expect(joined).toContain("section_end:");
    });

    it("disambiguates GitLab section keys when slugs would collide", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "success", "hello", "gitlab");
        const firstWrites = writes.join("");

        writes.length = 0;
        logCommandOutputCI("app_test", "success", "hello", "gitlab");
        const secondWrites = writes.join("");

        const sectionPattern = /section_start:\d+:(\w+)\[/;

        const sectionKeyOf = (output: string): string => {
            const matched = sectionPattern.exec(output);

            return matched ? (matched[1] ?? "") : "";
        };

        const firstKey = sectionKeyOf(firstWrites);
        const secondKey = sectionKeyOf(secondWrites);

        expect(firstKey).not.toBe("");
        // Distinct task ids that slugify to the same string must produce
        // distinct section keys so neither task's output collapses into
        // the other's section in the GitLab UI.
        expect(firstKey).not.toBe(secondKey);
    });

    it("emits Buildkite collapsed `---` heading when grouping is buildkite", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "success", "hello", "buildkite");

        const joined = writes.join("");

        expect(joined).toContain("--- ");
        expect(joined).toContain("app:test");
    });

    it("emits Azure Pipelines ##[group] directives when grouping is azure", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "success", "hello", "azure");

        const joined = writes.join("");

        expect(joined).toContain("##[group]");
        expect(joined).toContain("##[endgroup]");
    });

    it("keeps the failure output visible across every grouping mode", () => {
        expect.assertions(4);

        for (const mode of ["github", "gitlab", "buildkite", "azure"] as const) {
            writes.length = 0;
            logCommandOutputCI("app:test", "failure", "boom", mode);

            expect(writes.join("")).toContain("boom");
        }
    });

    it("still wraps a failed task in a GitHub ::group:: (groups are clickable)", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "failure", "boom", "github");

        const joined = writes.join("");

        expect(joined).toContain("::group::");
        expect(joined).toContain("::endgroup::");
    });

    it("emits an expanded GitLab section for a failed task (no [collapsed=true])", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "failure", "boom", "gitlab");

        const joined = writes.join("");

        // The section is still emitted so the log stays one-group-per-task,
        // but without the collapse flag so the failure is open by default.
        expect(joined).toContain("section_start:");
        expect(joined).not.toContain("[collapsed=true]");
    });

    it("collapses a successful GitLab section with [collapsed=true]", () => {
        expect.assertions(1);

        logCommandOutputCI("app:test", "success", "hello", "gitlab");

        expect(writes.join("")).toContain("[collapsed=true]");
    });

    it("opens a failed Buildkite section with the expanded `+++` heading", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "failure", "boom", "buildkite");

        const joined = writes.join("");

        // `+++` forces the section open; the collapsed `--- ` heading must
        // not be used for a failure.
        expect(joined).toContain("+++ ");
        expect(joined).not.toContain("--- ");
    });

    it("still wraps a failed Azure task in ##[group] (collapsed-only directive)", () => {
        expect.assertions(2);

        logCommandOutputCI("app:test", "failure", "boom", "azure");

        const joined = writes.join("");

        expect(joined).toContain("##[group]");
        expect(joined).toContain("##[endgroup]");
    });

    it("skips output entirely when the command produced no text", () => {
        expect.assertions(1);

        logCommandOutputCI("app:test", "success", "   \n  \n", "github");

        expect(writes).toStrictEqual([]);
    });
});
