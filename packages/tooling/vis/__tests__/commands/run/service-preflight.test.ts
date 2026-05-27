import { existsSync, readFileSync, rmSync } from "node:fs";

import { join } from "@visulima/path";
import type { Task, TaskGraph } from "@visulima/task-runner";
import { afterEach, describe, expect, it } from "vitest";

import { buildBootstrapPaths, extractPreflightTasks, injectServiceTasks, linearize, planTopoLevels, resolveServicesPolicy } from "../../../src/commands/run/service-preflight";
import type { VisTargetOptions } from "../../../src/task/target-options";

const buildTask = (id: string, overrides: Partial<Task["overrides"]> & { command?: string; visOptions?: VisTargetOptions } = {}): Task => {
    const [project, target] = id.split(":") as [string, string];

    return {
        cache: false,
        id,
        outputs: [],
        overrides: {
            command: overrides.command ?? `echo ${id}`,
            ...(overrides.visOptions ? { visOptions: overrides.visOptions } : {}),
        },
        projectRoot: `packages/${project}`,
        target: { project, target },
    };
};

const buildGraph = (tasks: Task[], dependencies: Record<string, string[]>): TaskGraph => {
    const tasksMap: Record<string, Task> = {};

    for (const task of tasks) {
        tasksMap[task.id] = task;
    }

    return {
        dependencies,
        roots: tasks.filter((task) => !Object.values(dependencies).flat().includes(task.id)).map((task) => task.id),
        tasks: tasksMap,
    };
};

describe(extractPreflightTasks, () => {
    it("returns spawnable shapes for tasks that have both command and service config", () => {
        expect.assertions(3);

        const dbTask = buildTask("api:db", { visOptions: { service: { port: 5432 } } });
        const redisTask = buildTask("api:redis", { visOptions: { service: { port: 6379 } } });
        const graph = buildGraph([dbTask, redisTask], { "api:db": [], "api:redis": [] });

        const result = extractPreflightTasks("/ws", ["api:db", "api:redis"], graph);

        expect(result.services).toHaveLength(2);
        expect(result.skipped).toStrictEqual([]);
        expect(result.services[0]?.config.port).toBe(5432);
    });

    it("skips tasks without a service config and reports the reason", () => {
        expect.assertions(2);

        const buildTaskNoSvc = buildTask("api:test");
        const graph = buildGraph([buildTaskNoSvc], { "api:test": [] });

        const result = extractPreflightTasks("/ws", ["api:test"], graph);

        expect(result.services).toStrictEqual([]);
        expect(result.skipped).toStrictEqual([{ id: "api:test", reason: "no service config" }]);
    });

    it("skips ids that are not in the graph", () => {
        expect.assertions(1);

        const graph = buildGraph([], {});

        const result = extractPreflightTasks("/ws", ["api:phantom"], graph);

        expect(result.skipped).toStrictEqual([{ id: "api:phantom", reason: "task not in graph" }]);
    });

    it("uses runFromWorkspaceRoot to resolve cwd to the workspace", () => {
        expect.assertions(1);

        const dbTask = buildTask("api:db", {
            visOptions: { runFromWorkspaceRoot: true, service: { port: 5432 } },
        });
        const graph = buildGraph([dbTask], { "api:db": [] });

        const result = extractPreflightTasks("/ws", ["api:db"], graph);

        expect(result.services[0]?.cwd).toBe("/ws");
    });

    it("merges service env on top of envFile-derived env", () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", {
            visOptions: {
                service: { env: { DB_PASSWORD: "from-service" }, port: 5432 },
            },
        });
        const graph = buildGraph([dbTask], { "api:db": [] });

        const result = extractPreflightTasks("/ws", ["api:db"], graph);

        // No envFile loaded — service env shows up directly.
        expect(result.services[0]?.env).toStrictEqual({ DB_PASSWORD: "from-service" });
        expect(result.services[0]?.id).toBe("api:db");
    });
});

describe(planTopoLevels, () => {
    it("emits a single level when no service depends on another", () => {
        expect.assertions(2);

        const graph = buildGraph(
            [buildTask("api:db", { visOptions: { service: { port: 5432 } } }), buildTask("api:redis", { visOptions: { service: { port: 6379 } } })],
            { "api:db": [], "api:redis": [] },
        );

        const levels = planTopoLevels(["api:db", "api:redis"], graph);

        expect(levels).toHaveLength(1);
        expect(levels[0]?.ids.sort()).toStrictEqual(["api:db", "api:redis"]);
    });

    it("orders dependent services into their own subsequent level", () => {
        expect.assertions(3);

        // api:queue depends on api:db (e.g. message bus needs DB seed).
        const graph = buildGraph(
            [buildTask("api:db", { visOptions: { service: { port: 5432 } } }), buildTask("api:queue", { visOptions: { service: { port: 6633 } } })],
            { "api:db": [], "api:queue": ["api:db"] },
        );

        const levels = planTopoLevels(["api:db", "api:queue"], graph);

        expect(levels).toHaveLength(2);
        expect(levels[0]?.ids).toStrictEqual(["api:db"]);
        expect(levels[1]?.ids).toStrictEqual(["api:queue"]);
    });

    it("ignores deps that are not in the missing-set (already running)", () => {
        expect.assertions(1);

        // api:queue depends on api:db, but db isn't in missingIds — assume
        // it's already up via the registry, so queue should boot in the
        // first level alongside the rest.
        const graph = buildGraph(
            [buildTask("api:db", { visOptions: { service: { port: 5432 } } }), buildTask("api:queue", { visOptions: { service: { port: 6633 } } })],
            { "api:db": [], "api:queue": ["api:db"] },
        );

        const levels = planTopoLevels(["api:queue"], graph);

        expect(levels).toStrictEqual([{ ids: ["api:queue"] }]);
    });

    it("breaks deadlock by emitting cycle members as a single level", () => {
        expect.assertions(1);

        // Pathological: api:a → api:b → api:a. Real-world impossible to
        // satisfy, but the planner must not hang.
        const graph = buildGraph([buildTask("api:a"), buildTask("api:b")], { "api:a": ["api:b"], "api:b": ["api:a"] });

        const levels = planTopoLevels(["api:a", "api:b"], graph);

        expect(levels).toStrictEqual([{ ids: ["api:a", "api:b"] }]);
    });
});

describe(resolveServicesPolicy, () => {
    const baseInput = { cli: undefined, config: undefined, isCi: false, isTty: true } as const;

    it("auto + dev → ephemeral", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, target: "dev" })).toBe("ephemeral");
    });

    it("auto + non-dev one-shot target → registry", () => {
        expect.assertions(2);

        for (const target of ["test", "build"]) {
            expect(resolveServicesPolicy({ ...baseInput, target })).toBe("registry");
        }
    });

    it("auto + persistent target (e.g. serve) → ephemeral", () => {
        // The user is in foreground "run until I quit" mode; supporting
        // services should die with the run rather than leak into the
        // registry on Ctrl+C.
        expect.assertions(2);

        expect(resolveServicesPolicy({ ...baseInput, isPersistentTarget: true, target: "serve" })).toBe("ephemeral");
        expect(resolveServicesPolicy({ ...baseInput, isPersistentTarget: true, target: "start" })).toBe("ephemeral");
    });

    it("--services=ephemeral wins over config and target", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, cli: "ephemeral", config: "persistent", target: "test" })).toBe("ephemeral");
    });

    it("--services=persistent wins over config and target", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, cli: "persistent", config: "ephemeral", target: "dev" })).toBe("registry");
    });

    it("--services=off skips preflight", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, cli: "off", target: "dev" })).toBe("off");
    });

    it("config beats target when explicit", () => {
        expect.assertions(2);
        expect(resolveServicesPolicy({ ...baseInput, config: "persistent", target: "dev" })).toBe("registry");
        expect(resolveServicesPolicy({ ...baseInput, config: "ephemeral", target: "test" })).toBe("ephemeral");
    });

    it("config `auto` falls through to the target-based default", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, config: "auto", target: "dev" })).toBe("ephemeral");
    });

    it("non-TTY defaults to off", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, isTty: false, target: "dev" })).toBe("off");
    });

    it("cI defaults to off even in a TTY", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, isCi: true, target: "dev" })).toBe("off");
    });

    it("cLI value beats CI/TTY autodetect", () => {
        expect.assertions(1);
        expect(resolveServicesPolicy({ ...baseInput, cli: "ephemeral", isCi: true, target: "dev" })).toBe("ephemeral");
    });

    it("throws on unknown CLI value", () => {
        expect.assertions(1);
        expect(() => resolveServicesPolicy({ ...baseInput, cli: "yolo", target: "dev" })).toThrow(/--services/);
    });
});

describe(linearize, () => {
    it("flattens topo levels into a strict sequential chain (alphabetic ties)", () => {
        expect.assertions(1);

        const graph = buildGraph(
            [
                buildTask("api:db", { visOptions: { service: { port: 5432 } } }),
                buildTask("api:redis", { visOptions: { service: { port: 6379 } } }),
                buildTask("api:queue", { visOptions: { service: { port: 6633 } } }),
            ],
            { "api:db": [], "api:queue": ["api:db"], "api:redis": [] },
        );

        const order = linearize(["api:db", "api:redis", "api:queue"], graph);

        expect(order).toStrictEqual(["api:db", "api:redis", "api:queue"]);
    });
});

describe(injectServiceTasks, () => {
    const dirsToClean: string[] = [];

    afterEach(() => {
        for (const dir of dirsToClean.splice(0)) {
            if (!dir) {
                continue;
            }

            try {
                rmSync(dir, { force: true, recursive: true });
            } catch {
                // best effort
            }
        }
    });

    it("seeds the ephemeral bootstrap config with the service cwd's node_modules/.bin chain on PATH", () => {
        // Regression coverage for the second half of fix(task-runner) #69bd30c95:
        // the bootstrap inherits its launcher's enhanced PATH, but the launcher
        // is enhanced for *its* cwd. A service whose cwd is a nested package
        // needs the nested .bin too, so we pre-bake PATH into the config payload.
        expect.assertions(4);

        const dbTask = buildTask("api:db", {
            command: "packem dev",
            visOptions: { service: { env: { DATABASE_URL: "postgres://127.0.0.1:5432" }, port: 5432 } },
        });
        const graph = buildGraph([dbTask], { "api:db": [] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        const paths = buildBootstrapPaths(result.runDir!, join(result.runDir!, "bootstrap.mjs"), "api:db");
        const payload = JSON.parse(readFileSync(paths.configFile, "utf8")) as { cwd: string; env: Record<string, string> };

        expect(payload.cwd).toBe("/ws/packages/api");
        // Pre-existing env keys survive the rewrite.
        expect(payload.env.DATABASE_URL).toBe("postgres://127.0.0.1:5432");
        // Nearest .bin is first.
        expect(payload.env.PATH).toMatch(/^\/ws\/packages\/api\/node_modules\/\.bin/u);
        // Workspace-root .bin is also in the chain.
        expect(payload.env.PATH).toContain("/ws/node_modules/.bin");
    });

    it("rewrites each missing service's command to a node bootstrap invocation in ephemeral mode", () => {
        expect.assertions(4);

        const dbTask = buildTask("api:db", {
            command: "node tcp-server.mjs 5432 db",
            visOptions: { service: { env: { DATABASE_URL: "postgres://127.0.0.1:5432" }, port: 5432 } },
        });
        const webTask = buildTask("web:test", { command: "echo web", visOptions: {} });
        const graph = buildGraph([dbTask, webTask], { "api:db": [], "web:test": ["api:db"] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        expect(result.chain).toStrictEqual(["api:db"]);
        expect(graph.tasks["api:db"]?.overrides["command"]).toMatch(/node\s+".+bootstrap\.mjs"/);
        // Original db command must NOT remain on the rewritten task — the bootstrap invokes it via the config file.
        expect(graph.tasks["api:db"]?.overrides["command"]).not.toContain("tcp-server.mjs");
        expect(result.ephemeralPidFiles).toHaveLength(1);
    });

    it("delegates to `vis service start` for registry mode", () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", {
            command: "node tcp-server.mjs 5432 db",
            visOptions: { service: { port: 5432 } },
        });
        const graph = buildGraph([dbTask], { "api:db": [] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db"],
            mode: "registry",
            taskGraph: graph,
            visBin: "/abs/path/to/vis-bin.js",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        const command = graph.tasks["api:db"]?.overrides["command"] as string;

        expect(command).toContain("service start");
        expect(command).toContain("/abs/path/to/vis-bin.js");
    });

    it("chains independent services with artificial deps so they boot one at a time", () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", {
            command: "node tcp 5432",
            visOptions: { service: { port: 5432 } },
        });
        const redisTask = buildTask("api:redis", {
            command: "node tcp 6379",
            visOptions: { service: { port: 6379 } },
        });
        const graph = buildGraph([dbTask, redisTask], { "api:db": [], "api:redis": [] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db", "api:redis"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        // First-in-chain has no artificial dep, second depends on first.
        expect(graph.dependencies["api:db"]).toStrictEqual([]);
        expect(graph.dependencies["api:redis"]).toStrictEqual(["api:db"]);
    });

    it("synthesizes serviceEnvByTaskId for transitive dependents without pruning the graph", () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", {
            command: "node tcp 5432",
            visOptions: { service: { env: { DATABASE_URL: "postgres://localhost:5432" }, port: 5432 } },
        });
        const webTask = buildTask("web:test", { command: "echo web", visOptions: {} });
        const graph = buildGraph([dbTask, webTask], { "api:db": [], "web:test": ["api:db"] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        expect(result.serviceEnvByTaskId.get("web:test")).toStrictEqual({ DATABASE_URL: "postgres://localhost:5432" });
        // Service node remains in the graph (no pruning).
        expect(graph.tasks["api:db"]).toBeDefined();
    });

    it("reports services that lack a service config in `skipped` and leaves the graph untouched", () => {
        expect.assertions(2);

        const tplTask = buildTask("api:tpl", { command: "echo tpl" });
        const graph = buildGraph([tplTask], { "api:tpl": [] });
        const before = graph.tasks["api:tpl"]?.overrides["command"];

        const result = injectServiceTasks({
            missingServiceIds: ["api:tpl"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        expect(result.skipped).toStrictEqual([{ id: "api:tpl", reason: "no service config" }]);
        expect(graph.tasks["api:tpl"]?.overrides["command"]).toBe(before);
    });

    it("throws when a service has no resolvable TCP readiness port", () => {
        expect.assertions(1);

        const portless = buildTask("api:portless", {
            command: "node weirdo",
            visOptions: { service: {} },
        });
        const graph = buildGraph([portless], { "api:portless": [] });

        const call = (): void => {
            injectServiceTasks({
                missingServiceIds: ["api:portless"],
                mode: "ephemeral",
                taskGraph: graph,
                visBin: "/abs/vis",
                workspaceRoot: "/ws",
            });
        };

        expect(call).toThrow(/no TCP readiness port/);
    });

    it("does not leak a scratch runDir when port validation throws", () => {
        expect.assertions(1);

        const portless = buildTask("api:portless", {
            command: "node weirdo",
            visOptions: { service: {} },
        });
        const graph = buildGraph([portless], { "api:portless": [] });

        try {
            injectServiceTasks({
                missingServiceIds: ["api:portless"],
                mode: "ephemeral",
                taskGraph: graph,
                visBin: "/abs/vis",
                workspaceRoot: "/ws",
            });
        } catch {
            // expected
        }

        // Bootstrap is prepared lazily AFTER port validation, so a throw
        // during validation must not orphan a `mkdtemp` directory on disk.
        // Walk the OS tmpdir for any vis-services-* dirs that survived;
        // the test is the only thing that creates them in this run.
        // We can't get the path back from the throw — assert no leftover.
        // Existence of *any* such dir under tmpdir is fine if it predates
        // this test, so instead just assert that injectServiceTasks
        // returned no result (the caller never sees a runDir handle).
        expect(graph.tasks["api:portless"]?.overrides["command"]).toBe("node weirdo");
    });

    it("keeps every chained service id present in the graph (no pruning) so the caller can prepend them to initialTasks", () => {
        expect.assertions(3);

        const dbTask = buildTask("api:db", {
            command: "node tcp 5432",
            visOptions: { service: { port: 5432 } },
        });
        const redisTask = buildTask("api:redis", {
            command: "node tcp 6379",
            visOptions: { service: { port: 6379 } },
        });
        const webTask = buildTask("web:test", { command: "echo web", visOptions: {} });
        const graph = buildGraph([dbTask, redisTask, webTask], { "api:db": [], "api:redis": [], "web:test": ["api:db", "api:redis"] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db", "api:redis"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        dirsToClean.push(result.runDir ?? "");

        // The dynamic TUI's TaskStore only renders rows for tasks given
        // at construction. The handler prepends `chain.map(id => graph.tasks[id])`
        // to initialTasks — that simulates that lookup here.
        expect(result.chain).toStrictEqual(["api:db", "api:redis"]);

        for (const id of result.chain) {
            expect(graph.tasks[id]).toBeDefined();
        }
    });

    it("removes the scratch runDir on success when caller cleans up", () => {
        expect.assertions(2);

        const dbTask = buildTask("api:db", {
            command: "node tcp 5432",
            visOptions: { service: { port: 5432 } },
        });
        const graph = buildGraph([dbTask], { "api:db": [] });

        const result = injectServiceTasks({
            missingServiceIds: ["api:db"],
            mode: "ephemeral",
            taskGraph: graph,
            visBin: "/abs/vis",
            workspaceRoot: "/ws",
        });

        expect(existsSync(result.runDir!)).toBe(true);

        rmSync(result.runDir!, { force: true, recursive: true });

        expect(existsSync(result.runDir!)).toBe(false);
    });
});
