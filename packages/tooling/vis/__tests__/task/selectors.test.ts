import type { WorkspaceConfiguration } from "@visulima/task-runner";
import { describe, expect, it } from "vitest";

import type { VisProjectConfiguration } from "../../src/config/workspace";
import { filterProjectsByQuery, parseQuery, parseTargetSelector, resolveSelector } from "../../src/task/selectors";

const makeWorkspace = (projects: Record<string, Partial<VisProjectConfiguration>>): WorkspaceConfiguration => {
    const full: Record<string, VisProjectConfiguration> = {};

    for (const [name, partial] of Object.entries(projects)) {
        full[name] = { root: partial.root ?? `packages/${name}`, ...partial };
    }

    return { projects: full };
};

describe(parseTargetSelector, () => {
    it("should parse `:build` as kind all with target build", () => {
        expect.assertions(2);

        const result = parseTargetSelector(":build");

        expect(result?.kind).toBe("all");
        expect(result?.target).toBe("build");
    });

    it("should parse `~:test` as kind closest with target test", () => {
        expect.assertions(2);

        const result = parseTargetSelector("~:test");

        expect(result?.kind).toBe("closest");
        expect(result?.target).toBe("test");
    });

    it("should parse `#frontend:build` as kind tag with tag frontend", () => {
        expect.assertions(3);

        const result = parseTargetSelector("#frontend:build");

        expect(result?.kind).toBe("tag");
        expect(result?.tag).toBe("frontend");
        expect(result?.target).toBe("build");
    });

    it("should parse `@scope/pkg:build` as kind project with target build", () => {
        expect.assertions(2);

        const result = parseTargetSelector("@scope/pkg:build");

        expect(result?.kind).toBe("project");
        expect(result?.target).toBe("build");
    });

    it("should parse bare `build` as kind all with target build", () => {
        expect.assertions(2);

        const result = parseTargetSelector("build");

        expect(result?.kind).toBe("all");
        expect(result?.target).toBe("build");
    });

    it("should return undefined for empty string", () => {
        expect.assertions(1);

        expect(parseTargetSelector("")).toBeUndefined();
    });
});

describe(parseQuery, () => {
    it("should parse a single clause with default && operator", () => {
        expect.assertions(3);

        const result = parseQuery("language=typescript");

        expect(result?.clauses).toHaveLength(1);
        expect(result?.op).toBe("&&");
        expect(result?.clauses[0]).toStrictEqual({ field: "language", op: "=", value: "typescript" });
    });

    it("should parse two clauses joined by &&", () => {
        expect.assertions(3);

        const result = parseQuery("tag=frontend && language=typescript");

        expect(result?.clauses).toHaveLength(2);
        expect(result?.op).toBe("&&");
        expect(result?.clauses).toStrictEqual([
            { field: "tag", op: "=", value: "frontend" },
            { field: "language", op: "=", value: "typescript" },
        ]);
    });

    it("should parse clauses joined by ||", () => {
        expect.assertions(2);

        const result = parseQuery("tag=a || tag=b");

        expect(result?.op).toBe("||");
        expect(result?.clauses).toStrictEqual([
            { field: "tag", op: "=", value: "a" },
            { field: "tag", op: "=", value: "b" },
        ]);
    });

    it("should throw when mixing && and ||", () => {
        expect.assertions(1);

        expect(() => parseQuery("tag=a && tag=b || tag=c")).toThrow(/mixed/i);
    });

    it("should return undefined for empty string", () => {
        expect.assertions(1);

        expect(parseQuery("")).toBeUndefined();
    });
});

describe(filterProjectsByQuery, () => {
    const workspace = makeWorkspace({
        "app-backend": { language: "go", tags: ["backend"] },
        "app-frontend": { language: "typescript", tags: ["frontend"] },
    });

    const allNames = ["app-frontend", "app-backend"];

    it("should return all projects when query is undefined", () => {
        expect.assertions(1);

        expect(filterProjectsByQuery(allNames, workspace, undefined)).toStrictEqual(allNames);
    });

    it("should filter by tag", () => {
        expect.assertions(1);

        expect(filterProjectsByQuery(allNames, workspace, "tag=frontend")).toStrictEqual(["app-frontend"]);
    });

    it("should filter by language", () => {
        expect.assertions(1);

        expect(filterProjectsByQuery(allNames, workspace, "language=go")).toStrictEqual(["app-backend"]);
    });

    it("should filter by compound && query", () => {
        expect.assertions(1);

        expect(filterProjectsByQuery(allNames, workspace, "tag=frontend && language=typescript")).toStrictEqual(["app-frontend"]);
    });

    it("should filter by compound || query", () => {
        expect.assertions(1);

        expect(filterProjectsByQuery(allNames, workspace, "tag=frontend || tag=backend")).toStrictEqual(allNames);
    });
});

describe(resolveSelector, () => {
    const workspace = makeWorkspace({
        "app-backend": { root: "packages/app-backend", tags: ["backend"] },
        "app-frontend": { root: "packages/app-frontend", tags: ["frontend"] },
    });

    const workspaceRoot = "/repo";

    it("should resolve `:build` to all projects", async () => {
        expect.assertions(2);

        const result = await resolveSelector(":build", workspace, "/repo", workspaceRoot);

        expect(result.target).toBe("build");
        expect(result.projects).toStrictEqual(["app-backend", "app-frontend"]);
    });

    it("should resolve `#frontend:build` to tagged projects only", async () => {
        expect.assertions(2);

        const result = await resolveSelector("#frontend:build", workspace, "/repo", workspaceRoot);

        expect(result.target).toBe("build");
        expect(result.projects).toStrictEqual(["app-frontend"]);
    });

    it("should resolve `~:build` to the closest project from cwd", async () => {
        expect.assertions(2);

        const result = await resolveSelector("~:build", workspace, "/repo/packages/app-frontend/src", workspaceRoot);

        expect(result.target).toBe("build");
        expect(result.projects).toStrictEqual(["app-frontend"]);
    });

    it("should throw for empty selector", async () => {
        expect.assertions(1);

        await expect(resolveSelector("", workspace, "/repo", workspaceRoot)).rejects.toThrow(/invalid target selector/i);
    });
});
