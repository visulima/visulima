import type { AiProviderConfig } from "../types";

// qwen -p "prompt" --yolo -o text
const qwen: AiProviderConfig = {
    alternateCommands: ["qwen-code"],
    buildArgs: (prompt, _model, _maxTokens) => ["-p", prompt, "--yolo", "-o", "text"],
    command: "qwen",
    defaultModel: "",
    envVariable: "QWEN_PATH",
};

export default qwen;
