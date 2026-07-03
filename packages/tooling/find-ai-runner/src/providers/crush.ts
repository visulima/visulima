import type { AiProviderConfig } from "../types";

// crush run [--yolo] [-m model] "prompt"
const crush: AiProviderConfig = {
    alternateCommands: [],
    buildArgs: (prompt, { dangerous, model }) => {
        const args = ["run"];

        if (dangerous) {
            args.push("--yolo");
        }

        if (model) {
            args.push("-m", model);
        }

        args.push(prompt);

        return args;
    },
    command: "crush",
    defaultModel: "",
    displayName: "Crush",
    envVariable: "CRUSH_PATH",
    // Crush sets CRUSH=1 (and AGENT=crush) on every shell exec; AI_AGENT=crush is covered by the generic marker.
    // See: https://github.com/charmbracelet/crush/blob/main/internal/shell/shell.go
    sessionMarkers: [
        { confidence: "definite", equals: "1", variable: "CRUSH" },
        { confidence: "definite", equals: "crush", variable: "AGENT" },
    ],
    supportsMaxTokens: false,
    supportsModel: true,
};

export default crush;
