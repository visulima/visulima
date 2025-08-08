import { findCacheDirSync } from "@visulima/find-cache-dir";
import { generateText } from "ai";
import type { LanguageModelV1 } from "ai";
import type { Solution, SolutionFinder, SolutionFinderFile } from "../../types";
import cache from "../../util/cache";
import debugLog from "../../util/debug-log";
import openAiPrompt from "./open-ai-prompt";
import openAiSolutionResponse from "./open-ai-solution-response";

const findCache = findCacheDirSync("visulima-flame");

debugLog(findCache === undefined ? "No cache directory found." : `Cache directory found at ${findCache}.`);

if (findCache === undefined) {
    console.warn("Caching is disabled, please check if you node_modules is writable.");
}

const cacheHandler = findCache ? cache(findCache) : undefined;

const DEFAULT_HEADER = "## Ai Generated Solution";
const DEFAULT_ERROR_MESSAGE = "Creation of a AI solution failed.";

// Provider names supported via optional peer deps
type SupportedProvider =
    | "openai"
    | "anthropic"
    | "google"
    | "mistral"
    | "ollama"
    | "azure-openai";

async function resolveModel(
    provider: SupportedProvider | undefined,
    modelId: string,
    apiKey?: string,
): Promise<LanguageModelV1> {
    const selected = provider ?? "openai";

    try {
        switch (selected) {
            case "openai": {
                const modulePath = "@ai-sdk/openai";
                const { createOpenAI } = (await import(modulePath)) as any;
                const client = createOpenAI(apiKey ? { apiKey } : undefined);
                return client(modelId) as LanguageModelV1;
            }
            case "anthropic": {
                const modulePath = "@ai-sdk/anthropic";
                const { createAnthropic } = (await import(modulePath)) as any;
                const client = createAnthropic(apiKey ? { apiKey } : undefined);
                return client(modelId) as LanguageModelV1;
            }
            case "google": {
                const modulePath = "@ai-sdk/google";
                const { createGoogleGenerativeAI } = (await import(modulePath)) as any;
                const client = createGoogleGenerativeAI(apiKey ? { apiKey } : undefined);
                return client(modelId) as LanguageModelV1;
            }
            case "mistral": {
                const modulePath = "@ai-sdk/mistral";
                const { createMistral } = (await import(modulePath)) as any;
                const client = createMistral(apiKey ? { apiKey } : undefined);
                return client(modelId) as LanguageModelV1;
            }
            case "ollama": {
                const modulePath = "@ai-sdk/ollama";
                const { createOllama } = (await import(modulePath)) as any;
                const client = createOllama(undefined);
                return client(modelId) as LanguageModelV1;
            }
            case "azure-openai": {
                const modulePath = "@ai-sdk/azure";
                const { createAzure } = (await import(modulePath)) as any;
                const client = createAzure(apiKey ? { apiKey } : undefined);
                return client(modelId) as LanguageModelV1;
            }
            default: {
                throw new Error(`Unsupported provider: ${selected}`);
            }
        }
    } catch (error) {
        throw new Error(
            `Failed to load provider "${selected}". Ensure the corresponding package is installed (e.g. @ai-sdk/${selected}) and accessible. Original error: ${(error as Error).message}`,
        );
    }
}

const OpenAiFinder: (
    options: Partial<{
        apikey: string;
        max_tokens: number;
        model: string;
        temperature: number;
        provider: SupportedProvider;
    }>,
) => SolutionFinder = (options = {}) => {
    return {
        handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
            const content = openAiPrompt({ applicationType: undefined, error, file });

            if (cacheHandler?.has(content)) {
                return {
                    body: openAiSolutionResponse(cacheHandler.get(content) ?? ""),
                    header: DEFAULT_HEADER,
                };
            }

            try {
                const model = await resolveModel(options.provider, options.model ?? "gpt-3.5-turbo", options.apikey);

                const result = await generateText({
                    model,
                    prompt: content,
                    maxTokens: options.max_tokens ?? 1000,
                    temperature: options.temperature ?? 0,
                });

                const messageContent = result.text;

                if (!messageContent) {
                    return {
                        body: openAiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                        header: DEFAULT_HEADER,
                    };
                }

                cacheHandler?.set(content, messageContent);

                return {
                    body: openAiSolutionResponse(messageContent),
                    header: DEFAULT_HEADER,
                };
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error(err);

                return {
                    body: openAiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                    header: DEFAULT_HEADER,
                };
            }
        },
        name: "AI SDK",
        priority: 99,
    };
};

export default OpenAiFinder;
