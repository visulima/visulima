import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Reads and parses a JSON file. Returns undefined if the file doesn't exist or isn't valid JSON.
 */
const readJsonFile = <T>(filePath: string): T | undefined => {
    try {
        const content = readFileSync(filePath, "utf8");

        return JSON.parse(content) as T;
    } catch {
        return undefined;
    }
};

/**
 * Checks if a file exists and contains valid JSON.
 */
const isJsonFile = (filePath: string): boolean => {
    if (!existsSync(filePath)) {
        return false;
    }

    try {
        JSON.parse(readFileSync(filePath, "utf8"));

        return true;
    } catch {
        return false;
    }
};

/**
 * Edits a JSON file in place using a mutator function.
 * The mutator receives the parsed data and should return the modified data,
 * or undefined to skip writing. Returns true if the file was modified.
 */
const editJsonFile = <T>(filePath: string, mutator: (data: T) => T | undefined): boolean => {
    if (!existsSync(filePath)) {
        return false;
    }

    const content = readFileSync(filePath, "utf8");

    let data: T;

    try {
        data = JSON.parse(content) as T;
    } catch {
        return false;
    }

    const result = mutator(data);

    if (result === undefined) {
        return false;
    }

    writeFileSync(filePath, `${JSON.stringify(result, undefined, 4)}\n`, "utf8");

    return true;
};

export { editJsonFile, isJsonFile, readJsonFile };
