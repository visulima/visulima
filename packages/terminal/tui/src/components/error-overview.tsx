/* eslint-disable @stylistic/multiline-ternary, react/function-component-definition */
import { existsSync, readFileSync } from "node:fs";
import { cwd } from "node:process";

import type { CodeExcerpt } from "code-excerpt";
import codeExcerpt from "code-excerpt";
import type { ReactElement } from "react";
import StackUtils from "stack-utils";

import Box from "./box";
import Text from "./text";

// Error's source file is reported as file:///home/user/file.js
// This function removes the file://[cwd] part
const cleanupPath = (path: string | undefined): string | undefined => path?.replace(`file://${cwd()}/`, "");

const stackUtils = new StackUtils({
    cwd: cwd(),
    internals: StackUtils.nodeInternals(),
});

type Props = {
    readonly error: Error;
};

export default function ErrorOverview({ error }: Props): ReactElement {
    const stack = error.stack ? error.stack.split("\n").slice(1) : undefined;
    const origin = stack ? stackUtils.parseLine(stack[0]!) : undefined;
    const filePath = cleanupPath(origin?.file);
    let excerpt: CodeExcerpt[] | undefined;
    let lineWidth = 0;

    if (filePath && origin?.line && existsSync(filePath)) {
        const sourceCode = readFileSync(filePath, "utf8");

        excerpt = codeExcerpt(sourceCode, origin.line);

        if (excerpt) {
            for (const { line } of excerpt) {
                lineWidth = Math.max(lineWidth, String(line).length);
            }
        }
    }

    return (
        <Box flexDirection="column" padding={1}>
            <Box>
                <Text backgroundColor="red" color="white">
                    {" "}
                    ERROR
{" "}
                </Text>

                <Text>
{" "}
{error.message}
                </Text>
            </Box>

            {origin && filePath ? (
                <Box marginTop={1}>
                    <Text dimColor>
                        {filePath}
:
{origin.line}
:
{origin.column}
                    </Text>
                </Box>
            ) : null}

            {origin && excerpt ? (
                <Box flexDirection="column" marginTop={1}>
                    {excerpt.map(({ line, value }) => (
                        <Box key={line}>
                            <Box width={lineWidth + 1}>
                                <Text
                                    aria-label={line === origin.line ? `Line ${line}, error` : `Line ${line}`}
                                    backgroundColor={line === origin.line ? "red" : undefined}
                                    color={line === origin.line ? "white" : undefined}
                                    dimColor={line !== origin.line}
                                >
                                    {String(line).padStart(lineWidth, " ")}
:
                                </Text>
                            </Box>

                            <Text backgroundColor={line === origin.line ? "red" : undefined} color={line === origin.line ? "white" : undefined} key={line}>
                                {` ${value}`}
                            </Text>
                        </Box>
                    ))}
                </Box>
            ) : null}

            {stack ? (
                <Box flexDirection="column" marginTop={1}>
                    {stack.map((line) => {
                        const parsedLine = stackUtils.parseLine(line);

                        // If the line from the stack cannot be parsed, we print out the unparsed line.
                        if (!parsedLine) {
                            return (
                                <Box key={line}>
                                    <Text dimColor>- </Text>
                                    <Text bold dimColor>
                                        {line}
                                        \t
{" "}
                                    </Text>
                                </Box>
                            );
                        }

                        return (
                            <Box key={line}>
                                <Text dimColor>- </Text>
                                <Text bold dimColor>
                                    {parsedLine.function}
                                </Text>
                                <Text
                                    aria-label={`at ${cleanupPath(parsedLine.file) ?? ""} line ${parsedLine.line} column ${parsedLine.column}`}
                                    color="gray"
                                    dimColor
                                >
                                    {" "}
                                    (
{cleanupPath(parsedLine.file) ?? ""}
:
{parsedLine.line}
:
{parsedLine.column}
)
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            ) : null}
        </Box>
    );
}
