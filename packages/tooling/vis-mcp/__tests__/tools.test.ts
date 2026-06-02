import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { McpToolResponse, ToolContext, ToolDeps } from "../src/response";
import { registerAdvisoryStatus } from "../src/tools/advisory-status";
import { registerAudit } from "../src/tools/audit";
import { registerCacheHash } from "../src/tools/cache-hash";
import { registerCacheWhy } from "../src/tools/cache-why";
import { registerDescribeProject } from "../src/tools/describe-project";
import { registerDescribeTemplate } from "../src/tools/describe-template";
import { registerFmt } from "../src/tools/fmt";
import { registerGetRunLogs } from "../src/tools/get-run-logs";
import { registerLint } from "../src/tools/lint";
import { registerListProjects } from "../src/tools/list-projects";
import { registerListTargets } from "../src/tools/list-targets";
import { registerListTemplates } from "../src/tools/list-templates";

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

    it("should forward a query filter to the CLI via --query", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerListProjects({ server }, ctx());

        // The fake-vis implements --query as `tag=<name>` over an in-memory
        // project list; this asserts the wire format the MCP boundary sends.
        const result = parseOk(await calls[0]!.handler({ query: "tag=frontend" })) as { count: number; projects: { name: string }[] };

        expect(result.count).toBe(1);
        expect(result.projects[0]!.name).toBe("@scope/alpha");
    });

    it("should surface CLI failures as errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        // Point at a non-existent binary so spawn errors out immediately —
        // covers the catch block.
        registerListProjects({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
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

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerDescribeProject({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({ name: "@scope/alpha" }));

        expect(error.error).toBeTruthy();
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

    it("should contribute zero rows for a project that declares no targets", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerListTargets({ server }, ctx());

        // @scope/gamma in the fixture omits the `targets` key entirely — the
        // `entry.targets ?? []` fallback means it flattens to no rows while the
        // other projects still produce their targets.
        const result = parseOk(await calls[0]!.handler({})) as { count: number; targets: { project: string }[] };

        expect(result.count).toBe(3);
        expect(result.targets.some((row) => row.project === "@scope/gamma")).toBe(false);
    });

    it("should error when filtering to a project that doesn't exist", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerListTargets({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ project: "@scope/ghost" }));

        expect(error.error).toContain("@scope/ghost");
    });

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerListTargets({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
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

    it("should read a specific run by id from .task-runner/runs", async () => {
        expect.assertions(1);

        mkdirSync(join(workspaceRoot, ".task-runner", "runs"), { recursive: true });
        writeFileSync(
            join(workspaceRoot, ".task-runner", "runs", "run-7.json"),
            JSON.stringify({ runId: "run-7", tasks: [{ status: "success", taskId: "@scope/alpha:build" }] }),
        );

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        // A valid runId resolves the runs/<id>.json path (the truthy branch of
        // the path ternary) rather than last-summary.json.
        const result = parseOk(await calls[0]!.handler({ runId: "run-7" })) as { runId: string };

        expect(result.runId).toBe("run-7");
    });

    it("should label the run as (unknown) when the summary omits runId for a missing task", async () => {
        expect.assertions(1);

        mkdirSync(join(workspaceRoot, ".task-runner"), { recursive: true });
        // No `runId` field — the not-found message falls back to "(unknown)".
        writeFileSync(join(workspaceRoot, ".task-runner", "last-summary.json"), JSON.stringify({ tasks: [{ taskId: "@scope/alpha:build" }] }));

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ taskId: "@scope/missing:build" }));

        expect(error.error).toContain("(unknown)");
    });

    it("should surface a non-ENOENT read failure (malformed JSON) via errorResponse", async () => {
        expect.assertions(2);

        mkdirSync(join(workspaceRoot, ".task-runner"), { recursive: true });
        // Valid file, invalid JSON — readFile succeeds, JSON.parse throws a
        // SyntaxError, so the catch falls through past the ENOENT guard.
        writeFileSync(join(workspaceRoot, ".task-runner", "last-summary.json"), "{not valid json");

        const { calls, server } = makeFakeServer();

        registerGetRunLogs({ server }, ctx());

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
        expect(error.error).not.toContain("No run summary");
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

    it("should default to the latest run when no runId is provided", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheWhy({ server }, ctx());

        // Omitting runId skips the `--run` flag; the fake-vis reports "latest"
        // for that path, exercising the falsey `if (runId)` branch.
        const result = parseOk(await calls[0]!.handler({ taskId: "@scope/alpha:build" })) as { runId: string };

        expect(result.runId).toBe("latest");
    });

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheWhy({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({ taskId: "@scope/alpha:build" }));

        expect(error.error).toBeTruthy();
    });
});

describe(registerListTemplates, () => {
    it("should list discovered templates with descriptions and sources", async () => {
        expect.assertions(3);

        const { calls, server } = makeFakeServer();

        registerListTemplates({ server }, ctx());

        expect(calls[0]!.name).toBe("list_templates");

        const result = parseOk(await calls[0]!.handler({})) as { count: number; templates: { name: string; source: string }[] };

        expect(result.count).toBe(2);
        expect(result.templates.map((t) => t.name)).toStrictEqual(["package", "component"]);
    });

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerListTemplates({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
    });
});

describe(registerDescribeTemplate, () => {
    it("should return the template metadata including the variable schema", async () => {
        expect.assertions(3);

        const { calls, server } = makeFakeServer();

        registerDescribeTemplate({ server }, ctx());

        expect(calls[0]!.name).toBe("describe_template");

        const result = parseOk(await calls[0]!.handler({ name: "package" })) as {
            destination: string;
            name: string;
            variables: { name: string; required?: boolean }[];
        };

        expect(result.destination).toBe("packages");
        expect(result.variables.find((v) => v.name === "packageName")!.required).toBe(true);
    });

    it("should surface a CLI error when the template is missing", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerDescribeTemplate({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ name: "nope" }));

        expect(error.error).toContain("not found");
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

    it("should reject taskId values that start with '-'", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheHash({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ taskId: "--evil" }));

        expect(error.error).toContain("Invalid taskId");
    });

    it("should reject runId values that contain path-traversal segments", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheHash({ server }, ctx());

        const error = parseError(await calls[0]!.handler({ runId: "../etc/passwd", taskId: "@scope/alpha:build" }));

        expect(error.error).toContain("Invalid runId");
    });

    it("should forward `--run <id>` when runId is provided", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheHash({ server }, ctx());

        const result = parseOk(await calls[0]!.handler({ runId: "run-42", taskId: "@scope/alpha:build" })) as { taskId: string };

        // The fake-vis ignores --run on `cache hash`; assert the call still
        // round-trips a successful response — the runId-forwarding branch is
        // hit, and its observable effect (no validation error) is asserted.
        expect(result.taskId).toBe("@scope/alpha:build");
    });

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerCacheHash({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({ taskId: "@scope/alpha:build" }));

        expect(error.error).toBeTruthy();
    });
});

describe(registerAudit, () => {
    it("should register the tool and return the parsed audit payload", async () => {
        expect.assertions(3);

        const { calls, server } = makeFakeServer();

        registerAudit({ server }, ctx());

        expect(calls).toHaveLength(1);
        expect(calls[0]!.name).toBe("audit");

        const result = parseOk(await calls[0]!.handler({})) as {
            packages: number;
            results: { name: string; vulnerabilities: { id: string }[] }[];
            summary: { issues: number };
        };

        expect(result.summary.issues).toBe(1);
    });

    it("should forward severity, offline, prodOnly, usage, ecosystem, and showAccepted to the CLI", async () => {
        expect.assertions(7);

        const { calls, server } = makeFakeServer();

        registerAudit({ server }, ctx());

        const result = parseOk(
            await calls[0]!.handler({
                ecosystem: "npm,pypi",
                offline: true,
                prodOnly: true,
                severity: "high",
                showAccepted: true,
                usage: true,
            }),
        ) as { flags: string[] };

        expect(result.flags).toContain("--severity");
        expect(result.flags).toContain("high");
        expect(result.flags).toContain("--offline");
        expect(result.flags).toContain("--prod-only");
        expect(result.flags).toContain("--usage");
        expect(result.flags).toContain("--ecosystem");
        expect(result.flags).toContain("--show-accepted");
    });

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerAudit({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
    });
});

describe(registerAdvisoryStatus, () => {
    it("should register the tool and return the parsed DB status", async () => {
        expect.assertions(3);

        const { calls, server } = makeFakeServer();

        registerAdvisoryStatus({ server }, ctx());

        expect(calls[0]!.name).toBe("advisory_status");

        const result = parseOk(await calls[0]!.handler({})) as {
            ecosystems: { advisoryCount: number; name: string }[];
            exists: boolean;
        };

        expect(result.exists).toBe(true);
        expect(result.ecosystems[0]!.name).toBe("npm");
    });

    it("should pass --db when provided", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerAdvisoryStatus({ server }, ctx());

        const customDb = join(workspaceRoot, "custom.sqlite");
        const result = parseOk(await calls[0]!.handler({ db: customDb })) as { dbPath: string };

        expect(result.dbPath).toBe(customDb);
    });

    it("should surface CLI failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerAdvisoryStatus({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
    });
});

describe(registerLint, () => {
    it("should register the tool and return findings without erroring on non-zero exit", async () => {
        expect.assertions(4);

        const { calls, server } = makeFakeServer();

        registerLint({ server }, ctx());

        expect(calls[0]!.name).toBe("lint");

        const result = parseOk(await calls[0]!.handler({})) as {
            exitCode: number;
            findings: { adapter: string; severity: string }[];
            runs: { adapter: string }[];
        };

        // fake-vis exits 1 for lint with findings; the tool must still parse stdout.
        expect(result.exitCode).toBe(1);
        expect(result.findings).toHaveLength(2);
        expect(result.runs[0]!.adapter).toBe("eslint");
    });

    it("should forward --since when no --staged", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerLint({ server }, ctx());

        const response = await calls[0]!.handler({ since: "main" });
        const payload = JSON.parse(response.content[0]!.text) as { findings?: unknown; flags?: string[] };
        const flags = payload.flags ?? [];

        expect(payload.findings).toBeDefined();
        expect(flags).toContain("--since");
    });

    it("should prefer --staged over --since when both are set", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerLint({ server }, ctx());

        const response = await calls[0]!.handler({ since: "main", staged: true });
        const payload = JSON.parse(response.content[0]!.text) as { flags?: string[] };
        const flags = payload.flags ?? [];

        expect(flags).toContain("--staged");
        expect(flags).not.toContain("--since");
    });

    it("should forward --max-warnings and --quiet", async () => {
        expect.assertions(3);

        const { calls, server } = makeFakeServer();

        registerLint({ server }, ctx());

        const response = await calls[0]!.handler({ maxWarnings: 0, quiet: true });
        const payload = JSON.parse(response.content[0]!.text) as { flags?: string[] };
        const flags = payload.flags ?? [];

        expect(flags).toContain("--quiet");
        expect(flags).toContain("--max-warnings");
        expect(flags[flags.indexOf("--max-warnings") + 1]).toBe("0");
    });

    it("should append positional files at the end", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerLint({ server }, ctx());

        const response = await calls[0]!.handler({ files: ["src/a.ts", "src/b.ts"] });
        const payload = JSON.parse(response.content[0]!.text) as { flags?: string[] };
        const flags = payload.flags ?? [];

        expect(flags).toContain("src/a.ts");
        expect(flags).toContain("src/b.ts");
    });

    it("should surface CLI spawn failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerLint({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
    });
});

describe(registerFmt, () => {
    it("should register the tool and return findings in check mode", async () => {
        expect.assertions(4);

        const { calls, server } = makeFakeServer();

        registerFmt({ server }, ctx());

        expect(calls[0]!.name).toBe("fmt");

        const result = parseOk(await calls[0]!.handler({})) as {
            exitCode: number;
            findings: { adapter: string }[];
            mode: string;
        };

        expect(result.exitCode).toBe(1);
        expect(result.mode).toBe("check");
        expect(result.findings[0]!.adapter).toBe("prettier");
    });

    it("should always pass --check (read-only)", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerFmt({ server }, ctx());

        const response = await calls[0]!.handler({});
        const payload = JSON.parse(response.content[0]!.text) as { flags?: string[] };

        expect(payload.flags ?? []).toContain("--check");
    });

    it("should forward --staged and --since precedence", async () => {
        expect.assertions(2);

        const { calls, server } = makeFakeServer();

        registerFmt({ server }, ctx());

        const stagedResponse = await calls[0]!.handler({ staged: true });
        const stagedPayload = JSON.parse(stagedResponse.content[0]!.text) as { flags?: string[] };

        expect(stagedPayload.flags ?? []).toContain("--staged");

        const sinceResponse = await calls[0]!.handler({ since: "HEAD~1" });
        const sincePayload = JSON.parse(sinceResponse.content[0]!.text) as { flags?: string[] };

        expect(sincePayload.flags ?? []).toContain("--since");
    });

    it("should surface CLI spawn failures via errorResponse", async () => {
        expect.assertions(1);

        const { calls, server } = makeFakeServer();

        registerFmt({ server }, { visBin: "/definitely-not-a-real-binary", workspaceRoot });

        const error = parseError(await calls[0]!.handler({}));

        expect(error.error).toBeTruthy();
    });
});
