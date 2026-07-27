import type { ProjectConfiguration, ProjectGraph } from "@visulima/task-runner";
import { describe, expect, it, vi } from "vitest";

import { VisUserError } from "../../src/errors/vis-user-error";
import { parsePorcelainStatus, selectAffectedProjects } from "../../src/task/affected-selection";

const { getAffectedProjectsMock } = vi.hoisted(() => {
    return { getAffectedProjectsMock: vi.fn() };
});

vi.mock(import("@visulima/task-runner"), async (importOriginal) => {
    return {
        ...(await importOriginal<Record<string, unknown>>()),
        getAffectedProjects: getAffectedProjectsMock,
    };
});

const projects: Record<string, ProjectConfiguration> = {
    api: { root: "packages/api" },
    web: { root: "packages/web" },
};

const projectGraph: ProjectGraph = { dependencies: {}, nodes: {} };
const workspace = { projectGraph, projects, workspaceRoot: "/repo" };

const emptyResult = {
    affectedProjects: [],
    changedFiles: [],
    changedProjects: [],
    downstreamProjects: [],
    upstreamProjects: [],
};

describe(parsePorcelainStatus, () => {
    it("should extract paths from NUL-delimited status entries", () => {
        expect.assertions(1);

        expect(parsePorcelainStatus(" M packages/web/src/app.ts\0?? packages/api/new.ts\0")).toStrictEqual([
            "packages/web/src/app.ts",
            "packages/api/new.ts",
        ]);
    });

    it("should keep paths containing spaces intact", () => {
        expect.assertions(1);

        expect(parsePorcelainStatus(" M packages/web/my file.ts\0")).toStrictEqual(["packages/web/my file.ts"]);
    });

    it("should return both sides of a rename so the old project is affected too", () => {
        expect.assertions(1);

        // Rename entries carry the destination in the status field and the
        // origin as a separate NUL-terminated field.
        expect(parsePorcelainStatus("R  packages/api/new.ts\0packages/web/old.ts\0")).toStrictEqual(["packages/api/new.ts", "packages/web/old.ts"]);
    });

    it("should ignore a trailing empty field", () => {
        expect.assertions(1);

        expect(parsePorcelainStatus("")).toStrictEqual([]);
    });
});

describe(selectAffectedProjects, () => {
    it("should reject an invalid downstream scope", async () => {
        expect.assertions(1);

        await expect(selectAffectedProjects({ downstream: "sideways" }, workspace)).rejects.toThrow(/Invalid --downstream value/);
    });

    it("should reject an invalid upstream scope", async () => {
        expect.assertions(1);

        await expect(selectAffectedProjects({ upstream: "sideways" }, workspace)).rejects.toThrow(/Invalid --upstream value/);
    });

    it("should fall back when base or head is an explicitly empty string", async () => {
        expect.assertions(2);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        // `--base=` reaches the resolver as "", which `??` would preserve and
        // hand to git as an empty ref.
        const result = await selectAffectedProjects({ base: "", head: "", uncommitted: false }, workspace);

        const call = getAffectedProjectsMock.mock.calls.at(-1)?.[0];

        expect(call.base).not.toBe("");
        expect(result.notes.join("\n")).toMatch(/Resolved affected refs/);
    });

    it("should reject an invalid scope as a user error, not a crash", async () => {
        expect.assertions(1);

        await expect(selectAffectedProjects({ downstream: "sideways" }, workspace)).rejects.toThrow(VisUserError);
    });

    it("should pass an explicit base and head straight through without resolving", async () => {
        expect.assertions(3);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        const result = await selectAffectedProjects({ base: "HEAD~3", head: "HEAD", uncommitted: false }, workspace);

        expect(getAffectedProjectsMock).toHaveBeenCalledWith(expect.objectContaining({ base: "HEAD~3", head: "HEAD" }));
        // Nothing was auto-resolved, so there is no provenance note.
        expect(result.notes).toStrictEqual([]);
        expect(result.uncommittedFileCount).toBe(0);
    });

    it("should fold working-tree changes into the changed-file set for local runs", async () => {
        expect.assertions(2);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        const result = await selectAffectedProjects({ base: "HEAD~1", head: "HEAD" }, workspace, {
            readWorkingTreeChanges: () => ["packages/web/src/dirty.ts"],
            runningInCi: false,
        });

        expect(getAffectedProjectsMock).toHaveBeenCalledWith(expect.objectContaining({ additionalChangedFiles: ["packages/web/src/dirty.ts"] }));
        expect(result.uncommittedFileCount).toBe(1);
    });

    it("should drop uncommitted paths outside every project", async () => {
        expect.assertions(2);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        // `git status` reports untracked scratch too. Any path mapping to no
        // project makes getAffectedProjects mark EVERY project affected, so
        // `--affected` would silently become "build everything".
        const result = await selectAffectedProjects({ base: "HEAD~1", head: "HEAD" }, workspace, {
            readWorkingTreeChanges: () => ["plans/", "notes.md", ".vis/last-summary.json", "packages/web/src/a.ts"],
            runningInCi: false,
        });

        expect(getAffectedProjectsMock).toHaveBeenCalledWith(expect.objectContaining({ additionalChangedFiles: ["packages/web/src/a.ts"] }));
        expect(result.notes.join("\n")).toMatch(/ignoring 3 uncommitted path\(s\) outside any project/);
    });

    it("should ignore the working tree in CI, where the checkout is the whole truth", async () => {
        expect.assertions(2);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        const readWorkingTreeChanges = vi.fn(() => ["packages/web/src/dirty.ts"]);
        const result = await selectAffectedProjects({ base: "HEAD~1", head: "HEAD" }, workspace, { readWorkingTreeChanges, runningInCi: true });

        expect(readWorkingTreeChanges).not.toHaveBeenCalled();
        expect(result.uncommittedFileCount).toBe(0);
    });

    it("should honor an explicit --uncommitted even in CI", async () => {
        expect.assertions(1);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        const result = await selectAffectedProjects({ base: "HEAD~1", head: "HEAD", uncommitted: true }, workspace, {
            readWorkingTreeChanges: () => ["packages/api/x.ts"],
            runningInCi: true,
        });

        expect(result.uncommittedFileCount).toBe(1);
    });

    it("should explain rather than silently drop --uncommitted when --head pins a commit", async () => {
        expect.assertions(2);

        getAffectedProjectsMock.mockResolvedValueOnce(emptyResult);

        const readWorkingTreeChanges = vi.fn(() => ["packages/api/x.ts"]);
        const result = await selectAffectedProjects({ base: "HEAD~3", head: "abc1234", uncommitted: true }, workspace, {
            readWorkingTreeChanges,
            runningInCi: false,
        });

        expect(readWorkingTreeChanges).not.toHaveBeenCalled();
        expect(result.notes.join("\n")).toMatch(/ignoring --uncommitted/);
    });
});
