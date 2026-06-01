/* eslint-disable @stylistic/multiline-ternary, react/function-component-definition */
import { existsSync, readFileSync } from "node:fs";
import { cwd } from "node:process";

import { parseStacktrace } from "@visulima/error/stacktrace";
import type { CodeExcerpt } from "code-excerpt";
import codeExcerpt from "code-excerpt";
import type { ReactElement } from "react";

import Box from "./box";
import Text from "./text";

// Error's source file is reported as file:///home/user/file.js
// or an absolute path. Strip both the `file://` scheme and a leading cwd
// so paths render relative to the working directory.
const cleanupPath = (path: string | undefined): string | undefined => {
    if (!path) {
        return path;
    }

    const workingDirectory = cwd();

    return path.replace(`file://${workingDirectory}/`, "").replace(`${workingDirectory}/`, "");
};

type Props = {
    readonly error: Error;
};

export default function ErrorOverview({ error }: Props): ReactElement {
    const traces = parseStacktrace(error);

    // Derive a stable, unique key per frame from its content. Stack frames can
    // repeat (e.g. empty `raw`, or `at native` recurring), so an occurrence
    // counter disambiguates duplicates without falling back to the array index.
    const traceKeyCounts = new Map<string, number>();
    const tracesWithKeys = traces.map((trace) => {
        const base
            = !trace.methodName && !trace.file
                ? `raw:${trace.raw}`
                : `${cleanupPath(trace.file) ?? ""}:${trace.line}:${trace.column}:${trace.methodName ?? ""}`;
        const occurrence = traceKeyCounts.get(base) ?? 0;

        traceKeyCounts.set(base, occurrence + 1);

        return { key: `${base}#${occurrence}`, trace };
    });

    const origin = traces[0];
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
                        <Box key={`excerpt-${line}`}>
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

                            <Text backgroundColor={line === origin.line ? "red" : undefined} color={line === origin.line ? "white" : undefined}>
                                {` ${value}`}
                            </Text>
                        </Box>
                    ))}
                </Box>
            ) : null}

            {traces.length > 0 ? (
                <Box flexDirection="column" marginTop={1}>
                    {tracesWithKeys.map(({ key, trace }) => {
                        const fileLabel = cleanupPath(trace.file) ?? "";

                        // Fall back to the raw stack line when none of the
                        // structured fields could be extracted.
                        if (!trace.methodName && !trace.file) {
                            return (
                                <Box key={key}>
                                    <Text dimColor>- </Text>
                                    <Text bold dimColor>
                                        {trace.raw}
                                    </Text>
                                </Box>
                            );
                        }

                        return (
                            <Box key={key}>
                                <Text dimColor>- </Text>
                                <Text bold dimColor>
                                    {trace.methodName ?? "<anonymous>"}
                                </Text>
                                <Text aria-label={`at ${fileLabel} line ${trace.line} column ${trace.column}`} color="gray" dimColor>
                                    {" "}
                                    (
{fileLabel}
:
{trace.line}
:
{trace.column}
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
