/* eslint-disable no-unsafe-optional-chaining, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/restrict-template-expressions */
const STYLE_TAG_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const SCRIPT_TAG_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const TEMPLATE_TAG_RE = /<template\b[^>]*>[\s\S]*?<\/template>/gi;
const STYLE_ATTR_RE = /style="([^"]*)"/g;

/**
 * Removes style and data attributes from a string.
 * @param inputString The input string to remove style and data attributes from
 * @returns The input string with style and data attributes removed
 */
const removeStyleAndDataAttributes = (inputString: string) => {
    let resultString = inputString
        .replaceAll(STYLE_TAG_RE, "")
        .replaceAll(SCRIPT_TAG_RE, "")
        .replaceAll(TEMPLATE_TAG_RE, "")
        .replaceAll("<!--$?-->", "")
        .replaceAll("<!--/$-->", "");

    resultString = resultString.replaceAll(STYLE_ATTR_RE, (_, styleValue) => {
        // Add a semicolon at the end of the style attribute if it doesn't already exist and remove spacing to remove false positives
        const updatedStyle = styleValue.trim().endsWith(";") ? styleValue : `${styleValue};`;

        return `style="${updatedStyle.replaceAll(" ", "")}"`;
    });

    return resultString;
};

const REACT_HYDRATION_ERROR_LINK = "https://react.dev/link/hydration-mismatch";

/**
 * Processes React hydration diff content to extract and format relevant differences.
 * @param error The raw error object containing hydration diff
 * @returns Formatted diff content with markers and limited context
 */
const processHydrationDiff = (error: Error): string | undefined => {
    const [hydrationMessage, diffContentMessage] = error.message.split(REACT_HYDRATION_ERROR_LINK);

    if (hydrationMessage) {
        const [message] = hydrationMessage?.split("\n\n");

        // eslint-disable-next-line no-param-reassign
        error.message = (message as string).replace(" This can happen if a SSR-ed Client Component used:", "");
    }

    const transformedDiffContent: string[] = [];

    for (const line of removeStyleAndDataAttributes(diffContentMessage?.trim() || "").split("\n") || []) {
        if (line.startsWith("+ ")) {
            transformedDiffContent.push(`[!code ++] ${line.slice(1)}`);
        } else if (line.startsWith("- ")) {
            transformedDiffContent.push(`[!code --] ${line.slice(1)}`);
        } else if (!line.includes(" ...")) {
            transformedDiffContent.push(line);
        }
    }

    let indexOfFirstDiff = transformedDiffContent.findIndex((line) => line.startsWith("[!code ++]"));

    if (indexOfFirstDiff === -1) {
        indexOfFirstDiff = transformedDiffContent.findIndex((line) => line.startsWith("[!code --]"));
    }

    if (indexOfFirstDiff === -1) {
        return undefined;
    }

    return transformedDiffContent.slice(Math.max(0, indexOfFirstDiff - 5)).join("\n");
};

export default processHydrationDiff;
