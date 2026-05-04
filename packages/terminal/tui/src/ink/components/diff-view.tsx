/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-use-before-define, consistent-return, default-case, no-void, react-x/no-array-index-key, react-you-might-not-need-an-effect/no-adjust-state-on-prop-change, react/function-component-definition, sonarjs/prefer-read-only-props */

/**
 * Diff viewer component for Ink.
 *
 * Displays file differences in unified or split (side-by-side) mode
 * with colored additions/deletions and optional inline character-level diffs.
 */
import { createPatch, diffChars, diffWords, parsePatch } from "diff";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ThemedToken } from "shiki";

import getHighlighter, { getCachedTokens, isLanguageSupported, resolveLanguage } from "../highlighter";
import useWindowSize from "../hooks/use-window-size";
import { renderTokenLine } from "../token-to-elements";
import Box from "./box";
import Text from "./text";

export type DiffViewMode = "split" | "unified";
export type InlineDiffMode = "chars" | "words";

export type Props = {
    /**
     * Number of unchanged context lines around changes.
     * @default 3
     */
    readonly context?: number;

    /**
     * Pre-computed unified diff string. If provided, `oldText`/`newText` are ignored.
     */
    readonly diff?: string;

    /**
     * Enable character-level inline diff highlighting within changed lines.
     * @default true
     */
    readonly inlineDiff?: boolean;

    /**
     * Granularity of inline diff highlighting.
     * - `"chars"` — character-level (best for code)
     * - `"words"` — word-level (best for prose)
     * @default "chars"
     */
    readonly inlineDiffMode?: InlineDiffMode;

    /**
     * Programming language for syntax highlighting within diff lines.
     * When provided, diff content is highlighted with Shiki.
     */
    readonly language?: string;

    /**
     * Display mode: unified (interleaved) or split (side-by-side).
     * @default "unified"
     */
    readonly mode?: DiffViewMode;

    /**
     * Label for the new version.
     */
    readonly newLabel?: string;

    /**
     * Modified text ("new" / right side).
     */
    readonly newText?: string;

    /**
     * Label for the old version.
     */
    readonly oldLabel?: string;

    /**
     * Original text ("old" / left side).
     */
    readonly oldText?: string;

    /**
     * Whether to display line numbers.
     * @default true
     */
    readonly showLineNumbers?: boolean;

    /**
     * Shiki theme for syntax highlighting.
     * @default "github-dark-default"
     */
    readonly theme?: string;
};

type DiffLine = {
    content: string;
    inlineDiff?: PrecomputedInlineDiff;
    newLineNum?: number;
    oldLineNum?: number;
    pairedIndex?: number;
    type: "add" | "context" | "del";
};

/**
 * Render a line's content using Shiki syntax tokens if available,
 * falling back to plain text with the given color.
 */
const renderHighlightedContent = (
    content: string,
    highlightedLines: ThemedToken[][] | null,
    lineNumber: number | undefined,
    fallbackColor?: string,
): ReactNode => {
    if (!highlightedLines || lineNumber === undefined || lineNumber < 1 || lineNumber > highlightedLines.length) {
        return fallbackColor ? <Text color={fallbackColor}>{content}</Text> : <Text dimColor>{content}</Text>;
    }

    const tokens = highlightedLines[lineNumber - 1];

    if (!tokens || tokens.length === 0) {
        return fallbackColor ? <Text color={fallbackColor}>{content}</Text> : <Text dimColor>{content}</Text>;
    }

    return renderTokenLine(tokens);
};

/**
 * Hook that asynchronously highlights text with Shiki when a language is provided.
 * Returns ThemedToken[][] (one array per line) or null if not ready.
 */
const useHighlightedLines = (text: string, language: string | undefined, theme: string): ThemedToken[][] | null => {
    const [tokens, setTokens] = useState<ThemedToken[][] | null>(null);
    const cancelledRef = useRef(false);

    useEffect(() => {
        cancelledRef.current = false;

        if (!language) {
            setTokens(null); // eslint-disable-line react-x/set-state-in-effect

            return;
        }

        const lang = resolveLanguage(language);

        if (!isLanguageSupported(lang)) {
            setTokens(null); // eslint-disable-line react-x/set-state-in-effect

            return;
        }

        void (async () => {
            try {
                const highlighter = await getHighlighter([lang], theme);
                const result = getCachedTokens(highlighter, text, lang, theme);

                if (!cancelledRef.current) {
                    setTokens(result.tokens);
                }
            } catch {
                if (!cancelledRef.current) {
                    setTokens(null);
                }
            }
        })();

        return () => {
            cancelledRef.current = true;
        };
    }, [text, language, theme]);

    return tokens;
};

/**
 * Parse a unified diff string into structured lines with optional precomputed inline diffs.
 */
const parseDiffLines = (diffString: string, enableInlineDiff: boolean, inlineDiffMode: InlineDiffMode = "chars"): { header: string; lines: DiffLine[] }[] => {
    const patches = parsePatch(diffString);
    const hunks: { header: string; lines: DiffLine[] }[] = [];

    for (const patch of patches) {
        for (const hunk of patch.hunks) {
            const header = `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`;
            const lines: DiffLine[] = [];
            let oldLine = hunk.oldStart;
            let newLine = hunk.newStart;

            for (const line of hunk.lines) {
                // Skip "\ No newline at end of file" markers
                if (line.startsWith("\\")) {
                    continue;
                }

                if (line.startsWith("+")) {
                    lines.push({ content: line.slice(1), newLineNum: newLine++, type: "add" });
                } else if (line.startsWith("-")) {
                    lines.push({ content: line.slice(1), oldLineNum: oldLine++, type: "del" });
                } else {
                    lines.push({ content: line.slice(1), newLineNum: newLine++, oldLineNum: oldLine++, type: "context" });
                }
            }

            // Precompute inline diffs for paired lines
            if (enableInlineDiff) {
                const pairs = findInlinePairs(lines);

                for (const [delIndex, addIndex] of pairs) {
                    if (lines[delIndex]!.type === "del" && lines[addIndex]!.type === "add") {
                        const computed = computeInlineDiff(lines[delIndex]!.content, lines[addIndex]!.content, inlineDiffMode);

                        lines[delIndex]!.inlineDiff = computed ?? undefined;
                        lines[delIndex]!.pairedIndex = addIndex;
                        lines[addIndex]!.inlineDiff = computed ?? undefined;
                        lines[addIndex]!.pairedIndex = delIndex;
                    }
                }
            }

            hunks.push({ header, lines });
        }
    }

    return hunks;
};

type InlineDiffPart = {
    highlight: boolean;
    value: string;
};

type PrecomputedInlineDiff = {
    addParts: InlineDiffPart[];
    delParts: InlineDiffPart[];
};

// Skip character-level diff for lines exceeding this length (O(n*m) would be too slow)
const INLINE_DIFF_MAX_LINE_LENGTH = 500;

/**
 * Precompute inline diff between paired del/add lines (character or word level).
 */
const computeInlineDiff = (oldContent: string, newContent: string, mode: InlineDiffMode = "chars"): PrecomputedInlineDiff | null => {
    if (oldContent.length > INLINE_DIFF_MAX_LINE_LENGTH || newContent.length > INLINE_DIFF_MAX_LINE_LENGTH) {
        return null;
    }

    const parts = mode === "words" ? diffWords(oldContent, newContent) : diffChars(oldContent, newContent);
    const delParts: InlineDiffPart[] = [];
    const addParts: InlineDiffPart[] = [];

    for (const part of parts) {
        if (part.removed) {
            delParts.push({ highlight: true, value: part.value });
        } else if (part.added) {
            addParts.push({ highlight: true, value: part.value });
        } else {
            delParts.push({ highlight: false, value: part.value });
            addParts.push({ highlight: false, value: part.value });
        }
    }

    return { addParts, delParts };
};

/**
 * Render precomputed inline diff parts.
 */
const renderInlineParts = (parts: InlineDiffPart[], color: string, bgColor: string): ReactNode => (
    <>
        {parts.map((part, index) => {
            if (part.highlight) {
                return (
                    <Text backgroundColor={bgColor} color="white" key={index}>
                        {part.value}
                    </Text>
                );
            }

            return (
                <Text color={color} key={index}>
                    {part.value}
                </Text>
            );
        })}
    </>
);

/**
 * Find paired del/add line blocks for inline diff.
 * Handles consecutive del blocks followed by consecutive add blocks.
 */
const findInlinePairs = (lines: DiffLine[]): Map<number, number> => {
    const pairs = new Map<number, number>();
    let index = 0;

    while (index < lines.length) {
        // Find a block of consecutive deletions
        const delStart = index;

        while (index < lines.length && lines[index]!.type === "del") {
            index++;
        }

        const delEnd = index;

        // Find a block of consecutive additions right after
        const addStart = index;

        while (index < lines.length && lines[index]!.type === "add") {
            index++;
        }

        const addEnd = index;

        // Pair them up (1:1, shorter block determines pair count)
        const delCount = delEnd - delStart;
        const addCount = addEnd - addStart;
        const pairCount = Math.min(delCount, addCount);

        for (let p = 0; p < pairCount; p++) {
            pairs.set(delStart + p, addStart + p);
            pairs.set(addStart + p, delStart + p);
        }

        // Skip non-del/add lines
        if (index === delStart) {
            index++;
        }
    }

    return pairs;
};

/**
 * Render unified diff view.
 */
function UnifiedView({
    hunks,
    newHighlighted,
    oldHighlighted,
    showLineNumbers,
}: {
    hunks: { header: string; lines: DiffLine[] }[];
    newHighlighted: ThemedToken[][] | null;
    oldHighlighted: ThemedToken[][] | null;
    showLineNumbers: boolean;
}): ReactElement {
    return (
        <Box flexDirection="column">
            {hunks.map((hunk, hunkIndex) => (
                <Box flexDirection="column" key={hunkIndex}>
                    {hunkIndex > 0
                        ? (
                        <Box marginBottom={0} marginTop={0}>
                            <Text dimColor>···</Text>
                        </Box>
                        )
                        : undefined}
                    <Text color="cyan" dimColor>
                        {hunk.header}
                    </Text>
                    {hunk.lines.map((line, lineIndex) => {
                        let lineContent: ReactNode;
                        let prefix: string;
                        let color: string | undefined;

                        switch (line.type) {
                            case "add": {
                                prefix = "+";
                                color = "green";
                                lineContent = line.inlineDiff
                                    ? renderInlineParts(line.inlineDiff.addParts, "green", "green")
                                    : renderHighlightedContent(line.content, newHighlighted, line.newLineNum, "green");
                                break;
                            }

                            case "del": {
                                prefix = "-";
                                color = "red";
                                lineContent = line.inlineDiff
                                    ? renderInlineParts(line.inlineDiff.delParts, "red", "red")
                                    : renderHighlightedContent(line.content, oldHighlighted, line.oldLineNum, "red");
                                break;
                            }

                            default: {
                                prefix = " ";
                                color = undefined;
                                lineContent = renderHighlightedContent(line.content, oldHighlighted, line.oldLineNum);
                                break;
                            }
                        }

                        return (
                            <Box key={lineIndex}>
                                {showLineNumbers
                                    ? (
                                    <Text color={color} dimColor={line.type === "context"}>
                                        {String(line.oldLineNum ?? "").padStart(4)}
{" "}
{String(line.newLineNum ?? "").padStart(4)}
{" "}
                                    </Text>
                                    )
                                    : undefined}
                                <Text color={color}>{prefix}</Text>
                                {lineContent}
                            </Box>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
}

/**
 * Render split (side-by-side) diff view.
 */
function SplitView({
    hunks,
    newHighlighted,
    oldHighlighted,
    showLineNumbers,
    width,
}: {
    hunks: { header: string; lines: DiffLine[] }[];
    newHighlighted: ThemedToken[][] | null;
    oldHighlighted: ThemedToken[][] | null;
    showLineNumbers: boolean;
    width: number;
}): ReactElement {
    const halfWidth = Math.floor(width / 2) - 1;

    return (
        <Box flexDirection="column">
            {hunks.map((hunk, hunkIndex) => {
                const separator
                    = hunkIndex > 0
                        ? (
                        <Box marginBottom={0} marginTop={0}>
                            <Text dimColor>···</Text>
                        </Box>
                        )
                        : undefined;

                // Build left (old) and right (new) lines using precomputed inline diffs
                const leftLines: { content: ReactNode; lineNum?: number }[] = [];
                const rightLines: { content: ReactNode; lineNum?: number }[] = [];

                for (let lineIndex = 0; lineIndex < hunk.lines.length; lineIndex++) {
                    const line = hunk.lines[lineIndex]!;

                    switch (line.type) {
                        case "add": {
                            // Only reach here for unpaired adds (paired adds handled by their del)
                            if (line.pairedIndex === undefined) {
                                leftLines.push({ content: <Text dimColor /> });
                                rightLines.push({
                                    content: renderHighlightedContent(line.content, newHighlighted, line.newLineNum, "green"),
                                    lineNum: line.newLineNum,
                                });
                            }

                            break;
                        }
                        case "context": {
                            leftLines.push({ content: renderHighlightedContent(line.content, oldHighlighted, line.oldLineNum), lineNum: line.oldLineNum });
                            rightLines.push({ content: renderHighlightedContent(line.content, newHighlighted, line.newLineNum), lineNum: line.newLineNum });

                            break;
                        }
                        case "del": {
                            if (line.pairedIndex === undefined) {
                                leftLines.push({
                                    content: renderHighlightedContent(line.content, oldHighlighted, line.oldLineNum, "red"),
                                    lineNum: line.oldLineNum,
                                });
                                rightLines.push({ content: <Text dimColor /> });
                            } else {
                                const pairedLine = hunk.lines[line.pairedIndex]!;

                                leftLines.push({
                                    content: line.inlineDiff
                                        ? renderInlineParts(line.inlineDiff.delParts, "red", "red")
                                        : renderHighlightedContent(line.content, oldHighlighted, line.oldLineNum, "red"),
                                    lineNum: line.oldLineNum,
                                });
                                rightLines.push({
                                    content: pairedLine.inlineDiff
                                        ? renderInlineParts(pairedLine.inlineDiff.addParts, "green", "green")
                                        : renderHighlightedContent(pairedLine.content, newHighlighted, pairedLine.newLineNum, "green"),
                                    lineNum: pairedLine.newLineNum,
                                });
                            }

                            break;
                        }
                        // No default
                    }
                }

                const rowCount = Math.max(leftLines.length, rightLines.length);

                return (
                    <Box flexDirection="column" key={hunkIndex}>
                        {separator}
                        <Text color="cyan" dimColor>
                            {hunk.header}
                        </Text>
                        {Array.from({ length: rowCount }, (_, rowIndex) => {
                            const left = leftLines[rowIndex];
                            const right = rightLines[rowIndex];

                            return (
                                <Box flexDirection="row" key={rowIndex}>
                                    <Box width={halfWidth}>
                                        {showLineNumbers
                                            ? (
<Text dimColor>
{String(left?.lineNum ?? "").padStart(4)}
{" "}
</Text>
                                            )
                                            : undefined}
                                        {left?.content}
                                    </Box>
                                    <Text dimColor>│</Text>
                                    <Box width={halfWidth}>
                                        {showLineNumbers
                                            ? (
<Text dimColor>
{String(right?.lineNum ?? "").padStart(4)}
{" "}
</Text>
                                            )
                                            : undefined}
                                        {right?.content}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                );
            })}
        </Box>
    );
}

/**
 * Display file differences with colored additions/deletions.
 *
 * ```tsx
 * &lt;DiffView oldText="hello" newText="hello world" />
 * &lt;DiffView diff={unifiedDiffString} mode="split" />
 * ```
 */
export default function DiffView({
    context = 3,
    diff: diffProp,
    inlineDiff = true,
    inlineDiffMode = "chars",
    language,
    mode = "unified",
    newLabel = "new",
    newText = "",
    oldLabel = "old",
    oldText = "",
    showLineNumbers = true,
    theme = "github-dark-default",
}: Props): ReactElement {
    const { columns } = useWindowSize();

    // Syntax highlighting for old and new text
    const oldHighlighted = useHighlightedLines(oldText, language, theme);
    const newHighlighted = useHighlightedLines(newText, language, theme);

    const diffString = useMemo(() => {
        if (diffProp) {
            return diffProp;
        }

        return createPatch("file", oldText, newText, oldLabel, newLabel, { context });
    }, [diffProp, oldText, newText, oldLabel, newLabel, context]);

    const hunks = useMemo(() => parseDiffLines(diffString, inlineDiff, inlineDiffMode), [diffString, inlineDiff, inlineDiffMode]);

    if (hunks.every((h) => h.lines.length === 0)) {
        return (
            <Box>
                <Text dimColor>No differences found.</Text>
            </Box>
        );
    }

    // File labels
    const labels = (
        <Box flexDirection="column">
            <Text color="red" dimColor>
                ---
{" "}
{oldLabel}
            </Text>
            <Text color="green" dimColor>
                +++
{" "}
{newLabel}
            </Text>
        </Box>
    );

    if (mode === "split") {
        return (
            <Box flexDirection="column">
                {labels}
                <SplitView
                    hunks={hunks}
                    newHighlighted={newHighlighted}
                    oldHighlighted={oldHighlighted}
                    showLineNumbers={showLineNumbers}
                    width={columns ?? 80}
                />
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {labels}
            <UnifiedView hunks={hunks} newHighlighted={newHighlighted} oldHighlighted={oldHighlighted} showLineNumbers={showLineNumbers} />
        </Box>
    );
}
