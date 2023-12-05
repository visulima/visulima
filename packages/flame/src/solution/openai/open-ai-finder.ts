import OpenAI from "openai";
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";
import findCacheDirectory from "find-cache-dir";

import type { Solution, SolutionFinder, SolutionFinderFile } from "../../types";
import openAiPrompt from "./open-ai-prompt";
import openAiSolutionResponse from "./open-ai-solution-response";
import cache from "../../util/cache";
import debugLog from "../../util/debug-log";
import * as console from "console";

const findCache = findCacheDirectory({ name: "visulima-flame" });

debugLog(findCache === undefined ? "No cache directory found." : `Cache directory found at ${findCache}.`);

if (findCache === undefined) {
    console.warn("Caching is disabled, please check if you node_modules is writable.");
}

const cacheHandler = findCache ? cache(findCache) : undefined;

const DEFAULT_HEADER = "## Ai Genereated Solution";
const DEFAULT_ERROR_MESSAGE = "Creation of a AI solution failed.";

const OpenAiFinder: (
    options: Partial<{
        apikey: string;
        max_tokens: number;
        model: ChatCompletionCreateParamsBase["model"];
        temperature: number;
    }>,
) => SolutionFinder = (options = {}) => {
    return {
        handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
            const openai = new OpenAI(options.apikey ? { apiKey: options.apikey } : undefined);

            const content = openAiPrompt({ applicationType: undefined, error, file });

            if (cacheHandler?.has(content)) {
                return {
                    body: openAiSolutionResponse(cacheHandler.get(content) ?? ""),
                    header: DEFAULT_HEADER,
                };
            }

            const chatCompletion = await openai.chat.completions
                .create({
                    max_tokens: options.max_tokens ?? 1000,
                    messages: [{ content, role: "user" }],
                    model: options.model ?? "gpt-3.5-turbo",
                    temperature: options.temperature ?? 0,
                })
                .catch((error) => {
                    console.log(error);

                    return DEFAULT_ERROR_MESSAGE;
                });

            const choices = (chatCompletion as OpenAI.Chat.Completions.ChatCompletion).choices;

            if (choices === undefined) {
                return {
                    body: openAiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                    header: DEFAULT_HEADER,
                };
            }

            const messageContent = (choices[0] as OpenAI.Chat.Completions.ChatCompletion.Choice).message.content;

            if (messageContent === null) {
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
        },
        name: "OpenAI",
        priority: 99,
    };
};

export default OpenAiFinder;
