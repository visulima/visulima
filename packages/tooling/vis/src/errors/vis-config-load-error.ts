import { VisConfigError } from "./vis-config-error";

/**
 * Wraps any throw raised by jiti while compiling a `vis.config.ts` /
 * `vis.task.ts`. Without this wrapper a user's syntax error surfaces as
 * "TypeError in workspace.ts" — which sends them debugging the wrong file.
 */
export class VisConfigLoadError extends VisConfigError {
    public constructor(filePath: string, chain: readonly string[], cause: unknown) {
        const causeMessage = cause instanceof Error ? cause.message : String(cause);
        const trail = chain.length > 0 ? `\nChain: ${chain.join(" → ")}` : "";

        super(`Failed to load ${filePath}: ${causeMessage}${trail}`, chain, { cause });
    }
}
