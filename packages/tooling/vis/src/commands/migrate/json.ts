import { writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";

import { backupFile } from "./backup";
import type { MigrationReport } from "./types";

/**
 * Reads and parses a JSON file. Returns undefined if the file doesn't exist or isn't valid JSON.
 */
const readJsonFile = <T>(filePath: string): T | undefined => {
    try {
        const content = readFileSync(filePath);

        return JSON.parse(content) as T;
    } catch {
        return undefined;
    }
};

/**
 * Checks if a file exists and contains valid JSON.
 */
const isJsonFile = (filePath: string): boolean => {
    if (!isAccessibleSync(filePath)) {
        return false;
    }

    try {
        JSON.parse(readFileSync(filePath));

        return true;
    } catch {
        return false;
    }
};

const INDENT_RE = /\n([ \t]+)"/;

/**
 * Detect the indentation used in a JSON file by looking at the first indented line.
 */
const detectJsonIndent = (content: string): number => {
    const match = INDENT_RE.exec(content);

    return match?.[1]?.length ?? 4;
};

/**
 * Edits a JSON file in place using a mutator function.
 * The mutator receives the parsed data and should return the modified data,
 * or undefined to skip writing. Returns true if the file was modified.
 * Preserves the original indentation style. When `report` is provided, a
 * `.bak` snapshot is taken before the write.
 */
const editJsonFile = <T>(filePath: string, mutator: (data: T) => T | undefined, report?: MigrationReport): boolean => {
    if (!isAccessibleSync(filePath)) {
        return false;
    }

    const content = readFileSync(filePath);

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

    const indent = detectJsonIndent(content);

    if (report) {
        backupFile(filePath, report);
    }

    writeFileSync(filePath, `${JSON.stringify(result, undefined, indent)}\n`, "utf8");

    return true;
};

export { detectJsonIndent, editJsonFile, isJsonFile, readJsonFile };
