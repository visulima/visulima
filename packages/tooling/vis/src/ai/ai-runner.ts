import type { AiProviderInfo } from "@visulima/find-ai-runner";
import { runProvider } from "@visulima/find-ai-runner";

/**
 * Shared scaffolding for AI-provider invocations across vis flows
 * (analysis, fix proposals). Centralises timeout, retry, and backoff
 * so the same UX applies to every provider call.
 */

export const AI_TIMEOUT_MS = 120_000;
export const MAX_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 1000;

/** Longer ceiling for handoffs where the CLI edits files across a repo. */
export const HANDOFF_TIMEOUT_MS = 600_000;

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Calls the provider with timeout + exponential-backoff retry. Bails
 * out immediately on a "timed out" error since retrying a hung
 * provider is unlikely to help and burns user time.
 */
export const runWithRetry = async (provider: AiProviderInfo, prompt: string, retries: number = MAX_RETRIES): Promise<string> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            const result = await runProvider(provider, prompt, { timeoutMs: AI_TIMEOUT_MS });

            return result.stdout;
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (lastError.message.includes("timed out")) {
                throw lastError;
            }

            if (attempt < retries) {
                const delay = RETRY_BASE_DELAY_MS * 2 ** attempt;

                await sleep(delay);
            }
        }
    }

    throw lastError ?? new Error("AI request failed after retries");
};

/**
 * Run a trusted prompt against a detected provider in permission-bypass mode
 * so it can edit files unattended, streaming its output as it arrives. Used by
 * the `vis migrate` AI handoff to finish steps that can't be migrated
 * statically. No retry: the CLI is mutating the working tree, so re-running a
 * partial edit is unsafe.
 * @param provider A detected, available provider.
 * @param prompt The (trusted) instruction prompt.
 * @param options Working directory and output-stream callbacks.
 * @param options.cwd Working directory for the spawned CLI (where edits land).
 * @param options.onStderr Called with each chunk of stderr as it arrives.
 * @param options.onStdout Called with each chunk of stdout as it arrives.
 * @returns The provider's stdout.
 */
export const runInteractiveHandoff = async (
    provider: AiProviderInfo,
    prompt: string,
    options: { cwd?: string; onStderr?: (chunk: string) => void; onStdout?: (chunk: string) => void } = {},
): Promise<string> => {
    const result = await runProvider(provider, prompt, {
        cwd: options.cwd,
        dangerous: true,
        onStderr: options.onStderr,
        onStdout: options.onStdout,
        timeoutMs: HANDOFF_TIMEOUT_MS,
    });

    return result.stdout;
};
