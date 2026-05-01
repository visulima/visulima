#!/usr/bin/env node
// Test fixture: stands in for the real `vis` CLI binary. The MCP exec layer
// spawns this with the same argv shape it would use against the real bin and
// reads stdout. We dispatch on argv to mirror the JSON shapes the real CLI
// emits — just enough surface area to exercise each MCP tool.

const argv = process.argv.slice(2);
const join = (parts) => parts.join(" ");
const command = join(argv);

const writeJson = (value) => process.stdout.write(JSON.stringify(value));
const writeStderr = (msg) => process.stderr.write(msg);

if (command.startsWith("list --targets --json")) {
    writeJson([
        {
            name: "@scope/alpha",
            language: "ts",
            type: "library",
            targets: [
                { name: "build", command: "tsc -b" },
                { name: "test", command: "vitest run" },
            ],
        },
        {
            name: "@scope/beta",
            language: "ts",
            type: "application",
            targets: [{ name: "build", command: "next build" }],
        },
    ]);
    process.exit(0);
}

if (command.startsWith("list --json")) {
    writeJson([
        { name: "@scope/alpha", language: "ts", type: "library" },
        { name: "@scope/beta", language: "ts", type: "application" },
    ]);
    process.exit(0);
}

if (command.startsWith("cache why")) {
    writeJson({
        taskId: argv[2],
        runId: argv.includes("--run") ? argv[argv.indexOf("--run") + 1] : "latest",
        diff: { command: { before: "tsc -b", after: "tsc -b --force" } },
    });
    process.exit(0);
}

if (command.startsWith("cache hash")) {
    writeJson({
        taskId: argv[2],
        hash: "abcdef0123456789",
        details: { command: "tsc -b", nodes: 4, runtime: "node-22" },
    });
    process.exit(0);
}

if (command.startsWith("run ")) {
    process.stdout.write("running task...\n");
    process.stdout.write("ok\n");
    process.exit(0);
}

if (command === "fail-bad-json") {
    process.stdout.write("not-json{");
    process.exit(0);
}

if (command === "fail-exit-code") {
    writeStderr("boom\n");
    process.exit(7);
}

writeStderr(`fake-vis: unknown command: ${command}\n`);
process.exit(2);
