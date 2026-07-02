import type { AiProviderConfig } from "../types";

// qwen -p "prompt" [--yolo] -o text [-m model]
const qwen: AiProviderConfig = {
    alternateCommands: ["qwen-code"],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["-p", prompt];

        if (dangerous) {
            args.push("--yolo");
        }

        args.push("-o", "text");

        if (model) {
            args.push("-m", model);
        }

        return args;
    },
    command: "qwen",
    defaultModel: "",
    displayName: "Qwen Code",
    envVariable: "QWEN_PATH",
    // Qwen Code sets gemini-cli's GEMINI_CLI (it is a fork); the marker lives on the gemini provider.
    sessionMarkers: [],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default qwen;
