import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DependencyGraph } from "../../../src/release/core/dep-graph";
import type { OrchestratorContext } from "../../../src/release/core/orchestrator";
import { printConfigIfRequested } from "../../../src/release/core/print-config";

const mkCtx = (): OrchestratorContext => {
    return {
        branch: "main",
        channel: { mode: "auto-publish", tag: "latest" },
        config: { baseBranch: "main", channels: { main: { tag: "latest" } } },
        cwd: "/r",
        depGraph: new DependencyGraph([]),
        firstRelease: false,
        packages: [],
        perPackageConfig: new Map(),
        plan: { consumedChangeFiles: [], releases: [], warnings: [] },
        pm: { id: "pnpm" } as never,
    };
};

let stdoutChunks: string[] = [];
let originalWrite: typeof process.stdout.write;

beforeEach(() => {
    stdoutChunks = [];
    originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
        stdoutChunks.push(typeof chunk === "string" ? chunk : chunk.toString());

        return true;
    });
});

afterEach(() => {
    process.stdout.write = originalWrite;
});

const noopLogger = { error: () => {}, info: () => {}, warn: () => {} } as unknown as Parameters<typeof printConfigIfRequested>[2];

describe(printConfigIfRequested, () => {
    it("returns false when --print-config is not set", () => {
        expect(printConfigIfRequested({}, mkCtx(), noopLogger)).toBe(false);
        expect(stdoutChunks.join("")).toBe("");
    });

    it("returns false on empty string", () => {
        expect(printConfigIfRequested({ printConfig: "" }, mkCtx(), noopLogger)).toBe(false);
    });

    it("prints user-facing config + returns true on truthy value", () => {
        const result = printConfigIfRequested({ printConfig: "true" }, mkCtx(), noopLogger);

        expect(result).toBe(true);

        const out = JSON.parse(stdoutChunks.join(""));

        expect(out.baseBranch).toBe("main");
        expect(out.channels.main.tag).toBe("latest");
        expect(out["__resolved__"]).toBeUndefined();
    });

    it("prints runtime-resolved fields with =debug", () => {
        const result = printConfigIfRequested({ printConfig: "debug" }, mkCtx(), noopLogger);

        expect(result).toBe(true);

        const out = JSON.parse(stdoutChunks.join(""));

        expect(out["__resolved__"]).toBeDefined();
        expect(out["__resolved__"].cwd).toBe("/r");
        expect(out["__resolved__"].packageManager).toBe("pnpm");
        expect(out["__resolved__"].channel.tag).toBe("latest");
    });

    it("redacts gitUser.email but preserves name (RFC §19.4)", () => {
        const ctx = mkCtx();

        ctx.config.gitUser = { email: "bot@example.com", name: "release-bot" };

        printConfigIfRequested({ printConfig: "true" }, ctx, noopLogger);

        const out = JSON.parse(stdoutChunks.join(""));

        expect(out.gitUser.name).toBe("release-bot");
        expect(out.gitUser.email).toBe("[REDACTED]");
    });

    it("leaves gitUser undefined when not configured", () => {
        printConfigIfRequested({ printConfig: "true" }, mkCtx(), noopLogger);

        const out = JSON.parse(stdoutChunks.join(""));

        expect(out.gitUser).toBeUndefined();
    });
});
