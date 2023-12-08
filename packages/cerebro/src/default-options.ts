import type { OptionDefinition } from "./@types/command";

const defaultOptions: OptionDefinition[] = [
    {
        description: "Display only the specified group",
        group: "global",
        name: "group",
        type: String,
    },
    {
        description: "Turn on verbose output",
        group: "global",
        name: "verbose",
        type: Boolean,
    },
    {
        description: "Turn on very-verbose output",
        group: "global",
        name: "very-verbose",
        type: Boolean,
    },
    {
        description: "Turn on debugging output",
        group: "global",
        name: "debug",
        type: Boolean,
    },
    {
        alias: "h",
        description: "Print out helpful usage information",
        group: "global",
        name: "help",
        type: Boolean,
    },
    {
        alias: "q",
        description: "Silence output",
        group: "global",
        name: "quiet",
        type: Boolean,
    },
    {
        alias: "V",
        description: "Print version info",
        group: "global",
        name: "version",
        type: Boolean,
    },
];

export default defaultOptions;
