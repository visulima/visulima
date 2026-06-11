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

if (command === "flood-stdout") {
    // Emit far more than any small test ceiling, then idle (never exiting) so
    // the parent's maxBufferBytes guard — not a natural exit — is what ends us.
    // Exercises the overflow branch in execVis.
    process.stdout.write("x".repeat(200_000));
    setInterval(() => {}, 1000);
} else if (command.startsWith("list --targets --json")) {
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
        // A project that omits the `targets` key entirely — exercises the
        // `entry.targets ?? []` fallback in list-targets. It contributes no
        // rows, so existing count/ordering assertions stay valid.
        {
            name: "@scope/gamma",
            language: "ts",
            type: "library",
        },
    ]);
    process.exit(0);
}

if (command.startsWith("list --json")) {
    const queryIndex = argv.indexOf("--query");
    const projects = [
        { name: "@scope/alpha", language: "ts", type: "library", tags: ["frontend"] },
        { name: "@scope/beta", language: "ts", type: "application", tags: ["backend"] },
    ];

    if (queryIndex !== -1) {
        const query = argv[queryIndex + 1] ?? "";
        // Filter on `tag=<name>` so tests can assert the query argument
        // was round-tripped through the MCP -> CLI boundary.
        const match = /^tag=(.+)$/.exec(query);
        const filtered = match ? projects.filter((project) => project.tags.includes(match[1])) : projects;

        writeJson(filtered);
        process.exit(0);
    }

    writeJson(projects);
    process.exit(0);
}

if (command === "generate --list --json") {
    writeJson([
        { name: "package", source: "native", path: "/ws/.vis/templates/package.ts", description: "Scaffold a workspace package" },
        { name: "component", source: "moon", path: "/ws/.moon/templates/component", description: "React component" },
    ]);
    process.exit(0);
}

if (argv[0] === "generate" && argv.includes("--describe") && argv.includes("--json")) {
    // The MCP boundary appends positionals after a literal `--` separator so a
    // flag-shaped name can't be reinterpreted as an option. Honour that here.
    const dashDash = argv.indexOf("--");
    const name = dashDash === -1 ? argv[1] : argv[dashDash + 1];

    if (name === "package") {
        writeJson({
            name: "package",
            source: "native",
            path: "/ws/.vis/templates/package.ts",
            description: "Scaffold a workspace package",
            destination: "packages",
            variables: [
                { name: "packageName", type: "string", required: true, prompt: "Package name" },
                { name: "license", type: "enum", values: ["MIT", "Apache-2.0"], default: "MIT" },
            ],
        });
        process.exit(0);
    }

    writeStderr(`Template "${name}" not found.\n`);
    process.exit(1);
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

if (argv[0] === "audit" && argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "json") {
    writeJson({
        packages: 42,
        duplicates: [],
        results: [
            {
                name: "lodash",
                version: "4.17.20",
                acceptedRisk: null,
                socketAlerts: [],
                socketScore: null,
                vulnerabilities: [
                    {
                        id: "GHSA-xxxx",
                        severity: "HIGH",
                        summary: "Prototype Pollution",
                        fixedVersions: ["4.17.21"],
                    },
                ],
            },
        ],
        summary: { accepted: 0, duplicatePackages: 0, issues: 1, total: 1 },
        flags: argv,
    });
    process.exit(0);
}

if (argv[0] === "lint" && argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "json") {
    writeJson({
        findings: [
            {
                adapter: "eslint",
                file: "/repo/src/a.ts",
                line: 10,
                column: 5,
                severity: "error",
                ruleId: "no-bad",
                message: "Bad thing detected",
                fixable: false,
            },
            {
                adapter: "oxlint",
                file: "/repo/src/b.ts",
                line: 3,
                severity: "warning",
                message: "warn",
            },
        ],
        runs: [
            { adapter: "eslint", durationMs: 1234, exitCode: 1, findingCount: 1 },
            { adapter: "oxlint", durationMs: 250, exitCode: 0, findingCount: 1 },
        ],
        flags: argv,
    });
    process.exit(1);
}

if (argv[0] === "fmt" && argv.includes("--check") && argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "json") {
    writeJson({
        mode: "check",
        findings: [
            {
                adapter: "prettier",
                file: "/repo/src/a.ts",
                severity: "info",
                message: "Code style issues would be auto-fixed",
                fixable: true,
            },
        ],
        runs: [{ adapter: "prettier", durationMs: 87, exitCode: 1, findingCount: 1 }],
        flags: argv,
    });
    process.exit(1);
}

if (argv[0] === "advisories" && argv[1] === "status" && argv.includes("--format") && argv[argv.indexOf("--format") + 1] === "json") {
    writeJson({
        dbPath: argv.includes("--db") ? argv[argv.indexOf("--db") + 1] : "/cache/vis/advisories/db.sqlite",
        exists: true,
        schemaVersion: 2,
        sizeBytes: 1024,
        ecosystems: [{ name: "npm", advisoryCount: 5000, lastSyncIso: "2026-05-01T00:00:00Z", manifestEtag: "etag-abc" }],
    });
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

if (command === "fail-empty-stderr") {
    // Non-zero exit with no stderr output — exercises the empty-`tail`
    // branch in execVisJson's error message (no trailing newline section).
    process.exit(5);
}

writeStderr(`fake-vis: unknown command: ${command}\n`);
process.exit(2);
