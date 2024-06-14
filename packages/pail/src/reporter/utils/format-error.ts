import { cyan, grey, red } from "@visulima/colorize";
// eslint-disable-next-line import/no-extraneous-dependencies
import wrapAnsi from "wrap-ansi";

const formatError = (error: Error, size: number, groupSpaces: string, hideName = false): string => {
    const { message, name, stack } = error;

    const items: string[] = [];

    items.push(
        ...(hideName ? [] : [groupSpaces + red(name), ": "]),
        wrapAnsi(message, size - 3, {
            hard: true,
            trim: false,
            wordWrap: true,
        }),
    );

    if (stack) {
        const lines = stack
            .split("\n")
            .splice(1)
            .map((line: string) => groupSpaces + line.trim().replace("file://", ""))
            .filter((line: string) => !line.includes("/pail/dist"));

        items.push(
            "\n",
            lines.map((line: string) => "  " + line.replace(/^at +/, (m) => grey(m)).replace(/\((.+)\)/, (_, m) => "(" + cyan(m as string) + ")")).join("\n"),
        );
    }

    return items.join("");
};

export default formatError;
