import type { LanguageModel } from "ai";
import { generateText } from "ai";

import type { Solution, SolutionFinder, SolutionFinderFile } from "../types";
import aiPrompt from "./ai-prompt";
import aiSolutionResponse from "./ai-solution-response";

const DEFAULT_HEADER = "## Ai Generated Solution";
const DEFAULT_ERROR_MESSAGE = "Creation of a AI solution failed.";

interface CacheOptions {
    enabled?: boolean;
    directory?: string;
    ttl?: number; // Time to live in milliseconds
}

const aiFinder = (
    model: LanguageModel,
    options?: {
        temperature?: number;
        cache?: CacheOptions;
    },
): SolutionFinder => {
    return {
        handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
            const content = aiPrompt({ applicationType: undefined, error, file });

            try {
                const result = await generateText({
                    model,
                    prompt: content,
                    temperature: options?.temperature ?? 0,
                });

                const messageContent = result.text;

                if (!messageContent) {
                    return {
                        body: aiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                        header: DEFAULT_HEADER,
                    };
                }

                return {
                    body: aiSolutionResponse(messageContent),
                    header: DEFAULT_HEADER,
                };
            } catch (error_) {
                // eslint-disable-next-line no-console
                console.error(error_);

                return {
                    body: aiSolutionResponse(DEFAULT_ERROR_MESSAGE),
                    header: DEFAULT_HEADER,
                };
            }
        },
        name: "AI SDK",
        priority: 99,
    };
};

export default aiFinder;
