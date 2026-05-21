import { dirname, resolve } from "node:path";

import { x, xSync } from "tinyexec";
import type { TsConfigJson } from "type-fest";

import type { Options } from "../src/read-tsconfig";

const tscPath = resolve("node_modules/.bin/tsc");

const TRAILING_NEWLINE_REGEX = /\n$/;

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
export const esc = (string_: string): string => string_.replaceAll("", String.raw`\x1b`);

/**
 * Return output of javascript file.
 */
export const execScriptSync = (file: string, flags: string[] = []): string => {
    // Anchor cwd to the script's directory so callers like `findTsConfigSync()` walk up
    // from inside the package fixtures rather than from the parent process's cwd (which
    // may be the repo root when invoked via lint-staged).
    const result = xSync(process.execPath, [file, ...flags], { nodeOptions: { cwd: dirname(file) } });

    // replace last newline in result
    return result.stdout.replace(TRAILING_NEWLINE_REGEX, "");
};

/**
 * Copy of the function from the package `get-tsconfig`.
 *
 * MIT License
 * Copyright (c) Hiroki Osame &lt;hiroki.osame@gmail.com>
 */
export const getTscTsconfig = async (cwd: string, filePath?: string): Promise<TsConfigJson> => {
    const output = await x(tscPath, ["--showConfig", ...(filePath ? ["--project", filePath] : [])], { nodeOptions: { cwd } });

    // tsc emits diagnostic text on stdout when --showConfig fails (e.g., circular extends, unresolved files).
    // Mirror execa's default `reject: true` by surfacing that text as the error message — tests pattern-match it.
    if (output.exitCode !== 0) {
        throw new Error(output.stdout.trim() || output.stderr.trim() || `tsc exited with code ${String(output.exitCode)}`);
    }

    return JSON.parse(output.stdout) as TsConfigJson;
};

export const parseVersion = (version: string): Options["tscCompatible"] | undefined => {
    const parts = version.split(".");

    if (parts.length < 2) {
        return undefined;
    }

    const major = Number.parseInt(parts[0] as string, 10);
    const minor = Number.parseInt(parts[1] as string, 10);

    if (Number.isNaN(major) || Number.isNaN(minor)) {
        return undefined;
    }

    return `${String(major)}.${String(minor)}` as Options["tscCompatible"];
};
