/**
 * Run-handler glue for first-class task arguments: turns a target's declared
 * argument schema + the forwarded CLI args into one of three outcomes the
 * handler acts on — render `--help`, fail with validation errors, or proceed
 * with the `VIS_ARG_*` env block. Kept pure (no logging / no throwing) so the
 * decision is unit-testable in isolation from the 2k-line run handler.
 */
import type { TaskArgument } from "../../task/arguments";
import { parseTaskArguments, renderTaskArgumentsHelp, taskArgumentEnv } from "../../task/arguments";

/** Outcome of resolving forwarded args against a target's argument schema. */
export type TaskArgumentResolution
    = | { env: Record<string, string>; kind: "ok" }
        | { errors: string[]; help: string; kind: "invalid" }
        | { kind: "help"; text: string };

/**
 * Resolve forwarded CLI args against a target's `arguments` schema.
 *
 * - No schema (or empty): `{ kind: "ok", env: {} }` — nothing to validate.
 * - `--help`/`-h` present: `{ kind: "help" }` — caller prints and exits 0.
 * - Validation errors: `{ kind: "invalid" }` — caller prints + fails the run.
 * - Otherwise: `{ kind: "ok", env }` with the `VIS_ARG_*` block to inject.
 */
export const resolveTaskArguments = (
    target: string,
    description: string | undefined,
    schema: TaskArgument[] | undefined,
    forwardedArgs: string[],
): TaskArgumentResolution => {
    if (!schema || schema.length === 0) {
        return { env: {}, kind: "ok" };
    }

    if (forwardedArgs.includes("--help") || forwardedArgs.includes("-h")) {
        return { kind: "help", text: renderTaskArgumentsHelp(target, description, schema) };
    }

    const parsed = parseTaskArguments(schema, forwardedArgs);

    if (parsed.errors.length > 0) {
        return { errors: parsed.errors, help: renderTaskArgumentsHelp(target, description, schema), kind: "invalid" };
    }

    return { env: taskArgumentEnv(parsed.values), kind: "ok" };
};
