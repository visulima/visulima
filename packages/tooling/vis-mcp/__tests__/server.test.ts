import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMcpServer } from "../src/server";

const FAKE_VIS = fileURLToPath(new URL("__fixtures__/fake-vis.mjs", import.meta.url));

let workspaceRoot: string;

beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), "vis-mcp-server-"));
});

afterEach(() => {
    rmSync(workspaceRoot, { force: true, recursive: true });
});

interface ToolListEntry {
    description?: string;
    name: string;
}

interface ToolListResult {
    tools: ToolListEntry[];
}

describe(createMcpServer, () => {
    it("registers all tools and round-trips a tools/list request through an in-memory transport", async () => {
        expect.assertions(1);

        const { server } = await createMcpServer({ visBin: FAKE_VIS, workspaceRoot });
        const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

        const client = new Client({ name: "vis-test-client", version: "0.0.0" });

        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

        try {
            const tools = (await client.listTools()) as ToolListResult;
            const names = tools.tools.map((t) => t.name).sort();

            // run_task is intentionally absent — Nx-style "agent prepares,
            // human executes" model. See ../README.md for rationale.
            expect(names).toStrictEqual([
                "advisory_status",
                "audit",
                "cache_hash",
                "cache_why",
                "describe_project",
                "describe_template",
                "get_run_logs",
                "list_projects",
                "list_targets",
                "list_templates",
            ]);
        } finally {
            await client.close();
            await server.close();
        }
    });

    it("invokes list_projects end-to-end and returns the captured stdout payload", async () => {
        expect.assertions(2);

        const { server } = await createMcpServer({ visBin: FAKE_VIS, workspaceRoot });
        const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

        const client = new Client({ name: "vis-test-client", version: "0.0.0" });

        await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

        try {
            const response = (await client.callTool({ arguments: {}, name: "list_projects" })) as {
                content: { text: string; type: string }[];
                isError?: boolean;
            };

            // okResponse omits the `isError` field entirely on success.
            expect(response.isError).toBeUndefined();

            const payload = JSON.parse(response.content[0]!.text) as { count: number };

            expect(payload.count).toBe(2);
        } finally {
            await client.close();
            await server.close();
        }
    });
});
