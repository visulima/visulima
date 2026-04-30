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
