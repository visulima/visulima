/* eslint-disable @typescript-eslint/prefer-nullish-coalescing, @typescript-eslint/restrict-template-expressions */
export interface ESBuildMessage extends Error {
    location?: {
        column?: number;
        file?: string;
        line?: number;
    };
    pluginName?: string;
    text: string;
}

/**
 * Checks if an array contains ESBuild error objects.
 * @param errors Array of potential ESBuild errors
 * @returns True if the array contains ESBuild errors
 */
export const isESBuildErrorArray = (errors: unknown[]): boolean => {
    if (!Array.isArray(errors) || errors.length === 0) {
        return false;
    }

    return errors.some((error: unknown) => error && typeof error === "object" && ("location" in error || "pluginName" in error || "text" in error));
};

/**
 * Processes ESBuild error messages into a standardized format.
 * @param esbuildErrors Array of ESBuild error messages
 * @returns Array of processed error objects with standardized structure
 */
export const processESBuildErrors = (
    esbuildErrors: ESBuildMessage[],
): {
    column?: number;
    file?: string;
    line?: number;
    message: string;
    name: string;
    plugin?: string;
    stack: string;
}[] =>
    esbuildErrors.map((buildError, index) => {
        const { location, pluginName, text } = buildError;

        const processedError: {
            column?: number;
            file?: string;
            line?: number;
            message: string;
            name: string;
            plugin?: string;
            stack: string;
        } = {
            message: text || `ESBuild error #${index + 1}`,
            name: buildError.name || "Error",
            stack: buildError.stack || "",
        };

        if (location) {
            processedError.file = location.file;
            processedError.line = location.line;
            processedError.column = location.column;
        }

        if (pluginName) {
            processedError.plugin = pluginName;
        }

        return processedError;
    });
