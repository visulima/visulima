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
export const isESBuildErrorArray = (errors: any[]): boolean => {
    if (!Array.isArray(errors) || errors.length === 0)
        return false;

    return errors.some((error: any) => error && typeof error === "object" && (error.location || error.pluginName || error.text));
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

        const processedError: any = {
            message: text || `ESBuild error #${index + 1}`,
        };

        if (location) {
            processedError.file = location.file;
            processedError.line = location.line;
            processedError.column = location.column;
        }

        if (pluginName) {
            processedError.plugin = pluginName;
        }

        processedError.name = buildError.name || "Error";
        processedError.stack = buildError.stack || "";

        return processedError;
    });
