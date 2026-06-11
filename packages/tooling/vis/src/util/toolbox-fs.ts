import type { CerebroFs } from "@visulima/cerebro";

export const pathExists = async (fs: CerebroFs, path: string): Promise<boolean> => {
    try {
        await fs.access(path);

        return true;
    } catch {
        return false;
    }
};

/**
 * Reads a UTF-8 file and parses it as JSON.
 *
 * On malformed JSON the underlying `SyntaxError` is rethrown with the file
 * path prepended, so callers (and every command migrated onto `toolbox.fs`)
 * surface *which* file failed to parse instead of a bare `Unexpected token …`.
 * @param fs The toolbox filesystem.
 * @param path Absolute path to the JSON file.
 * @throws SyntaxError When the file contents are not valid JSON. The message
 *   is prefixed with the file path; `cause` references the original error.
 */
export const readJsonFile = async <T = unknown>(fs: CerebroFs, path: string): Promise<T> => {
    const contents = await fs.readFile(path, "utf8");

    try {
        return JSON.parse(contents) as T;
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const wrapped = new SyntaxError(`Failed to parse JSON in ${path}: ${reason}`);

        (wrapped as { cause?: unknown }).cause = error;

        throw wrapped;
    }
};

export const writeJsonFile = async (fs: CerebroFs, path: string, value: unknown, indent = 4): Promise<void> =>
    fs.writeFile(path, `${JSON.stringify(value, undefined, indent)}\n`, "utf8");

export const removeFile = async (fs: CerebroFs, path: string): Promise<void> => fs.rm(path, { force: true });
