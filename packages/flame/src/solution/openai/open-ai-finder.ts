import OpenAI from "openai";
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";

import type { Solution, SolutionFinder, SolutionFinderFile } from "../../types";
import openAiPrompt from "./open-ai-prompt";
import openAiSolutionResponse from "./open-ai-solution-response";
import * as console from "console";

const OpenAiFinder: (
    options: Partial<{
        apikey: string;
        max_tokens: number;
        model: ChatCompletionCreateParamsBase["model"];
        temperature: number;
    }>,
) => SolutionFinder = (options = {}) => {return {
    handle: async (error: Error, file: SolutionFinderFile): Promise<Solution | undefined> => {
        const openai = new OpenAI(options.apikey ? { apiKey: options.apikey } : undefined);

        const content = openAiPrompt({ applicationType: undefined, error, file });

        const chatCompletion = await openai.chat.completions
            .create({
                max_tokens: options.max_tokens ?? 1000,
                messages: [{ content, role: "user" }],
                model: options.model ?? "gpt-3.5-turbo",
                temperature: options.temperature ?? 0,
            })
            .catch((error) => {
                console.log(error);

                return "Creation of a AI solution failed.";
            });



        return {
            body: openAiSolutionResponse(chatCompletion.choices[0].message.content),
            header: "Ai Genereated Solution",
        }
    },
    name: "OpenAI",
    priority: 99,
}};

export default OpenAiFinder;
