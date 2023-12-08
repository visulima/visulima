import type { OptionDefinition } from "./@types/command";

const defaultOptions: OptionDefinition[] = [
    {
        description: "turn on verbose output",
        group: "global",
        name: "verbose",
        type: Boolean,
    },
    {
        description: "turn on very-verbose output",
        group: "global",
        name: "very-verbose",
        type: Boolean,
    },
    {
        description: "turn on debugging output",
        group: "global",
        name: "debug",
        type: Boolean,
    },
    {
        alias: "h",
        description: "print out helpful usage information",
        group: "global",
        name: "help",
        type: Boolean,
    },
    {
        alias: "q",
        description: "silence output",
        group: "global",
        name: "quiet",
        type: Boolean,
    },
    {
        alias: "V",
        description: "print version info",
        group: "global",
        name: "version",
        type: Boolean,
    },
];

export default defaultOptions;
