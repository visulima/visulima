import type { AiProviderConfig } from "../types";

const codex: AiProviderConfig = {
    alternateCommands: ["openai-codex"],
    buildArgs: (prompt, model, maxTokens) => [prompt, "--approval-mode", "full-auto", "--quiet", "--model", model, "--max-tokens", String(maxTokens)],
    command: "codex",
    defaultModel: "o3",
    envVariable: "CODEX_PATH",
};

export default codex;
