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
    // Qwen Code (Alibaba's gemini-cli fork) sets QWEN_CODE=1 on every shell exec. It also inherits
    // the fork's GEMINI_CLI marker, so QWEN_CODE must be checked FIRST to attribute the session
    // to Qwen rather than misreporting it as Gemini CLI.
    sessionMarkers: [{ confidence: "definite", equals: "1", variable: "QWEN_CODE" }],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default qwen;
