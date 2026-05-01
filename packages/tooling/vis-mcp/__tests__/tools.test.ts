import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { McpToolResponse, ToolContext, ToolDeps } from "../src/response";
import { registerCacheHash } from "../src/tools/cache-hash";
import { registerCacheWhy } from "../src/tools/cache-why";
import { registerDescribeProject } from "../src/tools/describe-project";
import { registerGetRunLogs } from "../src/tools/get-run-logs";
import { registerListProjects } from "../src/tools/list-projects";
import { registerListTargets } from "../src/tools/list-targets";

const FAKE_VIS = fileURLToPath(new URL("__fixtures__/fake-vis.mjs", import.meta.url));

interface CapturedTool {
    config: { annotations?: unknown; description?: string; inputSchema?: unknown };
    handler: (args: Record<string, unknown>) => Promise<McpToolResponse>;
    name: string;
}

const makeFakeServer = (): { calls: CapturedTool[]; server: ToolDeps["server"] } => {
    const calls: CapturedTool[] = [];

    const server = {
        registerTool: (name: string, config: CapturedTool["config"], handler: CapturedTool["handler"]): void => {
            calls.push({ config, handler, name });
        },
    } as unknown as ToolDeps["server"];

    return { calls, server };
};

const parseOk = (response: McpToolResponse): unknown => {
    if (response.isError) {
        throw new Error(`expected ok response, got error: ${response.content[0]!.text}`);
    }

    return JSON.parse(response.content[0]!.text);
};

const parseError = (response: McpToolResponse): { error: string } => {
    if (!response.isError) {
        throw new Error(`expected error response, got ok: ${response.content[0]!.text}`);
    }

    return JSON.parse(response.content[0]!.text) as { error: string };
};

let workspaceRoot: string;

beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "vis-mcp-test-"));
});

afterEach(() => {
    rmSync(workspaceRoot, { force: true, recursive: true });
});

const ctx = (): ToolContext => {
    return { visBin: FAKE_VIS, workspaceRoot };
};

describe(registerListProjects, () => {
    it("should register the tool and return a project list", async () => {
        expect.assertions(3);

        const { calls, server } = makeFakeServer();

        registerListProjects({ server }, ctx());

        expect(calls).toHaveLength(1);
        expect(calls[0]!.name).toBe("list_projects");

        const result = parseOk(await calls[0]!.handler({})) as { count: number; projects: unknown[] };

        expect(result.count).toBe(2);
    });
});

describe(registerDescribeProject, () => {
    it("should return the matching project", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerDescribeProject({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({ name: "@scope/alpha" })) as { name: string };

        expect(calls[0]!.name).toBe("describe_project");
        expect(result.name).toBe("@scope/alpha");
    });

    it("should return an error when the project is not found", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerDescribeProject({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ name: "@scope/missing" }));

        expect(error.error).toContain("@scope/missing");
    });
});

describe(registerListTargets, () => {
    it("should flatten projects into per-target rows", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerListTargets({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({})) as { count: number; targets: { project: string; target: string }[] };

        expect(result.count).toBe(3);
        expect(result.targets.map((row) => row.project)).toStrictEqual(["@scope/alpha", "@scope/alpha", "@scope/beta"]);
    });

    it("should narrow to a single project when `project` is set", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerListTargets({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({ project: "@scope/beta" })) as { count: number };

        expect(result.count).toBe(1);
    });

    it("should error when filtering to a project that doesn't exist", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerListTargets({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ project: "@scope/ghost" }));

        expect(error.error).toContain("@scope/ghost");
    });
});

describe(registerGetRunLogs, () => {
    it("should reject runId values containing path-traversal segments", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const traversal = parseError(await calls[0]!.handler({ runId: "../../../etc/passwd" }));
        const slash = parseError(await calls[0]!.handler({ runId: "subdir/run-1" }));

        expect(traversal.error).toContain("Invalid runId");
        expect(slash.error).toContain("Invalid runId");
    });

    it("should error helpfully when no run summary exists", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toContain("No run summary");
    });

    it("should return the latest summary when present", async () => {
        expect.assertions(1);

        mkdirSync(join(workspaceRoot, ".task-runner"), { recursive: true });
        writeFileSync(
            join(workspaceRoot, ".task-runner", "last-summary.json"),
            JSON.stringify({ runId: "run-1", tasks: [{ status: "success", taskId: "@scope/alpha:build" }] }),
        );

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({})) as { runId: string };

        expect(result.runId).toBe("run-1");
    });

    it("should filter to a single task with `taskId`", async () => {
        expect.assertions(1);

        mkdirSync(join(workspaceRoot, ".task-runner"), { recursive: true });
        writeFileSync(
            join(workspaceRoot, ".task-runner", "last-summary.json"),
            JSON.stringify({
                runId: "run-1",
                tasks: [
                    { status: "success", taskId: "@scope/alpha:build" },
                    { status: "failure", taskId: "@scope/beta:build" },
                ],
            }),
        );

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({ taskId: "@scope/beta:build" })) as { task: { status: string } };

        expect(result.task.status).toBe("failure");
    });

    it("should error when the requested task is not in the summary", async () => {
        expect.assertions(1);

        mkdirSync(join(workspaceRoot, ".task-runner"), { recursive: true });
        writeFileSync(join(workspaceRoot, ".task-runner", "last-summary.json"), JSON.stringify({ runId: "run-1", tasks: [{ taskId: "@scope/alpha:build" }] }));

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ taskId: "@scope/missing:build" }));

        expect(error.error).toContain("@scope/missing:build");
    });
});

describe(registerCacheWhy, () => {
    it("should reject taskId values that start with '-'", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheWhy({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ taskId: "--help" }));

        expect(error.error).toContain("Invalid taskId");
    });

    it("should reject taskId values without ':'", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheWhy({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ taskId: "no-colon" }));

        expect(error.error).toContain("Invalid taskId");
    });

    it("should reject runId values with path traversal", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheWhy({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ runId: "../etc", taskId: "@scope/alpha:build" }));

        expect(error.error).toContain("Invalid runId");
    });

    it("should pass `--run` when runId is set and return the diff", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerCacheWhy({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({ runId: "run-42", taskId: "@scope/alpha:build" })) as {
            runId: string;
            taskId: string;
        };

        expect(result.taskId).toBe("@scope/alpha:build");
        expect(result.runId).toBe("run-42");
    });
});

describe(registerCacheHash, () => {
    it("should return the recorded hash for a task", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerCacheHash({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({ taskId: "@scope/alpha:build" })) as { hash: string; taskId: string };

        expect(result.taskId).toBe("@scope/alpha:build");
        expect(result.hash).toBe("abcdef0123456789");
    });
});
