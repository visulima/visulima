import type { Command } from "@visulima/cerebro";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildDiscoveryPayload, renderDiscoveryJson, renderDiscoveryText } from "../../../src/commands/ai/discovery";
import { aiDiscoverHelpExecute, aiRootExecute } from "../../../src/commands/ai/handler";

const ANSI_RE = new RegExp(String.raw`${String.fromCodePoint(27)}\[[0-9;]*m`, "gu");
const stripAnsi = (s: string): string => s.replaceAll(ANSI_RE, "");

const makeCommand = (overrides: Partial<Command> = {}): Command => {
    return {
        description: "Sample command",
        examples: [],
        execute: () => undefined,
        name: "sample",
        ...overrides,
    };
};

interface StreamSpy {
    readonly value: string;
}

const spyStream = (stream: NodeJS.WriteStream): StreamSpy => {
    let captured = "";

    vi.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array): boolean => {
        captured += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();

        return true;
    });

    return {
        get value() {
            return captured;
        },
    };
};

describe(buildDiscoveryPayload, () => {
    it("should build payload with command, description, and subcommands", () => {
        expect.assertions(3);

        const payload = buildDiscoveryPayload([makeCommand({ commandPath: ["ai"], description: "List providers", name: "providers" })]);

        expect(payload.command).toBe("ai");
        expect(payload.description).toContain("AI-assisted commands");
        expect(payload.subcommands).toHaveLength(1);
    });

    it("should compose path from commandPath + name", () => {
        expect.assertions(2);

        const payload = buildDiscoveryPayload([
            makeCommand({ commandPath: ["ai"], name: "providers" }),
            makeCommand({ commandPath: ["ai", "cache"], name: "stats" }),
        ]);

        expect(payload.subcommands[0]?.path).toBe("ai providers");
        expect(payload.subcommands[1]?.path).toBe("ai cache stats");
    });

    it("should fall back to bare name when commandPath is missing", () => {
        expect.assertions(1);

        const payload = buildDiscoveryPayload([makeCommand({ name: "ai" })]);

        expect(payload.subcommands[0]?.path).toBe("ai");
    });

    it("should normalise option type functions to lowercase strings", () => {
        expect.assertions(3);

        const payload = buildDiscoveryPayload([
            makeCommand({
                commandPath: ["ai"],
                name: "fix",
                options: [
                    { description: "Format", name: "format", type: String },
                    { defaultValue: false, description: "Apply", name: "apply", type: Boolean },
                    { description: "Count", name: "count", type: Number },
                ],
            }),
        ]);

        expect(payload.subcommands[0]?.options[0]?.type).toBe("string");
        expect(payload.subcommands[0]?.options[1]?.type).toBe("boolean");
        expect(payload.subcommands[0]?.options[2]?.type).toBe("number");
    });

    it("should include argument metadata when present", () => {
        expect.assertions(2);

        const payload = buildDiscoveryPayload([
            makeCommand({
                argument: { description: "Task ID", name: "taskId", type: String },
                commandPath: ["ai"],
                name: "fix",
            }),
        ]);

        expect(payload.subcommands[0]?.argument?.name).toBe("taskId");
        expect(payload.subcommands[0]?.argument?.description).toBe("Task ID");
    });

    it("should map examples into command/description tuples", () => {
        expect.assertions(2);

        const payload = buildDiscoveryPayload([
            makeCommand({
                commandPath: ["ai"],
                examples: [
                    ["vis ai providers", "List all providers"],
                    ["vis ai providers --format json", "JSON output"],
                ],
                name: "providers",
            }),
        ]);

        expect(payload.subcommands[0]?.examples).toHaveLength(2);
        expect(payload.subcommands[0]?.examples[0]).toEqual({
            command: "vis ai providers",
            description: "List all providers",
        });
    });
});

describe(renderDiscoveryJson, () => {
    it("should produce valid parseable JSON ending with a newline", () => {
        expect.assertions(3);

        const output = renderDiscoveryJson([makeCommand({ commandPath: ["ai"], description: "List providers", name: "providers" })]);

        expect(output.endsWith("\n")).toBe(true);

        const parsed = JSON.parse(output) as { command: string; subcommands: { path: string }[] };

        expect(parsed.command).toBe("ai");
        expect(parsed.subcommands[0]?.path).toBe("ai providers");
    });

    it("should be machine-readable with no ANSI escapes", () => {
        expect.assertions(1);

        const output = renderDiscoveryJson([makeCommand({ commandPath: ["ai"], description: "Test", name: "test" })]);

        expect(output).not.toMatch(ANSI_RE);
    });
});

describe(renderDiscoveryText, () => {
    it("should mention every subcommand by full path", () => {
        expect.assertions(3);

        const subcommands = [
            makeCommand({ commandPath: ["ai"], description: "List providers", name: "providers" }),
            makeCommand({ commandPath: ["ai"], description: "Test provider", name: "test" }),
            makeCommand({ commandPath: ["ai", "cache"], description: "Cache stats", name: "stats" }),
        ];

        const output = stripAnsi(renderDiscoveryText(subcommands));

        expect(output).toContain("vis ai providers");
        expect(output).toContain("vis ai test");
        expect(output).toContain("vis ai cache stats");
    });

    it("should list options with their types", () => {
        expect.assertions(2);

        const output = stripAnsi(
            renderDiscoveryText([
                makeCommand({
                    commandPath: ["ai"],
                    name: "fix",
                    options: [
                        { description: "Format", name: "format", type: String },
                        { defaultValue: false, description: "Apply", name: "apply", type: Boolean },
                    ],
                }),
            ]),
        );

        expect(output).toContain("--format=<string>");
        expect(output).toContain("--apply");
    });

    it("should render argument segment when an argument is declared", () => {
        expect.assertions(1);

        const output = stripAnsi(
            renderDiscoveryText([
                makeCommand({
                    argument: { description: "Task ID", name: "taskId", type: String },
                    commandPath: ["ai"],
                    name: "fix",
                }),
            ]),
        );

        expect(output).toContain("<taskId>");
    });

    it("should render examples", () => {
        expect.assertions(2);

        const output = stripAnsi(
            renderDiscoveryText([
                makeCommand({
                    commandPath: ["ai"],
                    examples: [["vis ai providers --format json", "JSON output"]],
                    name: "providers",
                }),
            ]),
        );

        expect(output).toContain("vis ai providers --format json");
        expect(output).toContain("JSON output");
    });

    it("should always point users at the discover-help subcommand", () => {
        expect.assertions(1);

        const output = stripAnsi(renderDiscoveryText([]));

        expect(output).toContain("vis ai discover-help");
    });
});

describe(aiRootExecute, () => {
    let stdout: StreamSpy;
    let stderr: StreamSpy;

    beforeEach(() => {
        stdout = spyStream(process.stdout);
        stderr = spyStream(process.stderr);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should write text discovery to stderr (no JSON branch on root)", async () => {
        expect.assertions(2);

        await aiRootExecute({ options: {} } as never);

        expect(stdout.value).toBe("");
        expect(stripAnsi(stderr.value)).toContain("vis ai —");
    });
});

describe(aiDiscoverHelpExecute, () => {
    let stdout: StreamSpy;
    let stderr: StreamSpy;

    beforeEach(() => {
        stdout = spyStream(process.stdout);
        stderr = spyStream(process.stderr);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should write JSON to stdout", async () => {
        expect.assertions(3);

        await aiDiscoverHelpExecute({ options: {} } as never);

        expect(stderr.value).toBe("");
        expect(stdout.value).not.toBe("");

        const parsed = JSON.parse(stdout.value) as { command: string; subcommands: { name: string }[] };

        expect(parsed.command).toBe("ai");
    });

    it("should exclude the root ai command from listed subcommands", async () => {
        expect.assertions(2);

        await aiDiscoverHelpExecute({ options: {} } as never);

        const parsed = JSON.parse(stdout.value) as { subcommands: { name: string; path: string }[] };

        expect(parsed.subcommands.some((c) => c.name === "ai" && c.path === "ai")).toBe(false);
        expect(parsed.subcommands.length).toBeGreaterThan(0);
    });

    it("should list every non-root ai subcommand the package registers", async () => {
        expect.assertions(6);

        await aiDiscoverHelpExecute({ options: {} } as never);

        const parsed = JSON.parse(stdout.value) as { subcommands: { path: string }[] };
        const paths = parsed.subcommands.map((c) => c.path);

        expect(paths).toContain("ai discover-help");
        expect(paths).toContain("ai providers");
        expect(paths).toContain("ai test");
        expect(paths).toContain("ai fix");
        // Cache management lives under `vis cache` now — the ai cache subtree
        // is intentionally absent so AI agents are pointed at the unified
        // surface in their discovery payload.
        expect(paths).not.toContain("ai cache stats");
        expect(paths).not.toContain("ai cache clear");
    });
});
