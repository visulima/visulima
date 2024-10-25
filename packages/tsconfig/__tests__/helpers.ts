import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { execa } from "execa";
import type { TsConfigJson } from "type-fest";

import type { Options } from "../src/read-tsconfig";

const tscPath = resolve("node_modules/.bin/tsc");

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
export const esc = (string_: string): string => string_.replaceAll("", "\\x1b");

/**
 * Return output of javascript file.
 */
export const execScriptSync = (file: string, flags: string[] = []): string => {
    const cmd = `node "${file}" ${flags.join(" ")}`;
    const result = execSync(cmd);

    // replace last newline in result
    return result.toString().replace(/\n$/, "");
};

/**
 * Copy of the function from the package `get-tsconfig`.
 *
 * MIT License
 * Copyright (c) Hiroki Osame <hiroki.osame@gmail.com>
 */
export const getTscTsconfig = async (cwd: string): Promise<TsConfigJson> => {
    const output = await execa(tscPath, ["--showConfig"], { cwd });

    return JSON.parse(output.stdout);
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

    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    return `${major}.${minor}` as Options["tscCompatible"];
};
