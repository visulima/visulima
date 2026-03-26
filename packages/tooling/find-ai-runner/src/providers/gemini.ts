import type { AiProviderConfig } from "../types";

const gemini: AiProviderConfig = {
    alternateCommands: ["gemini-cli"],
    buildArgs: (prompt, model, maxTokens) => ["--sandbox", "--model", model, "--max-output-tokens", String(maxTokens), "-p", prompt],
    command: "gemini",
    defaultModel: "gemini-2.5-pro",
    envVariable: "GEMINI_PATH",
};

export default gemini;
