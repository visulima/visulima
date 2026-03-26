import type { AiProviderConfig } from "../types";

const claude: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, model, _maxTokens) => ["--dangerously-skip-permissions", "--model", model, "--output-format", "text", "-p", prompt],
    command: "claude",
    defaultModel: "claude-sonnet-4-20250514",
    envVariable: "CLAUDE_PATH",
};

export default claude;
