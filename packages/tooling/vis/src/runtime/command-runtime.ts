/**
 * Bridges the runtime resolver into command handlers (Phase 1 of the
 * cross-runtime multi-tool — see `rfc/design-runtime-multitool.md`).
 *
 * Reads the global `--runtime` flag and `vis.config.ts` `runtime:`, resolves
 * the target runtime (flag → VIS_RUNTIME → config → lockfile → node), and
 * surfaces the deferred-runtime notice (e.g. a detected Deno project) on the
 * logger. The `--runtime`/`VIS_RUNTIME` env precedence is handled inside
 * `resolveRuntime`.
 */
import type { RuntimeId } from "./adapters/types";
import type { RuntimeResolution } from "./resolve-runtime";
import { resolveRuntime } from "./resolve-runtime";

interface RuntimeCommandContext {
    logger?: { warn?: (...arguments_: unknown[]) => void };
    /** Raw command/global options bag — the `--runtime` flag is read defensively. */
    options?: unknown;
    visConfig?: { runtime?: RuntimeId };
}

/** Read the global `--runtime` flag out of a loosely-typed options bag. */
const readRuntimeFlag = (options: unknown): string | undefined => {
    if (options !== null && typeof options === "object" && "runtime" in options) {
        const value = (options as { runtime?: unknown }).runtime;

        if (typeof value === "string") {
            return value;
        }
    }

    return undefined;
};

export const resolveCommandRuntime = (context: RuntimeCommandContext, cwd: string): RuntimeResolution => {
    const resolution = resolveRuntime(cwd, { config: context.visConfig?.runtime, flag: readRuntimeFlag(context.options) });

    if (resolution.deferredNotice !== undefined) {
        context.logger?.warn?.(resolution.deferredNotice);
    }

    return resolution;
};

/**
 * The installer backend a resolved runtime forces. Today the mapping is
 * one-way: `bun` runtime pins the `bun` PM/exec backend; `node` leaves backend
 * selection to lockfile/config detection (pnpm/npm/yarn). Returns `undefined`
 * when the runtime should not override backend detection.
 */
export const runtimeInstallerBackend = (resolution: RuntimeResolution): "bun" | undefined =>
    (resolution.runtime === "bun" ? "bun" : undefined);
