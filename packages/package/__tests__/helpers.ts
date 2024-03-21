import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { execa } from "execa";
import type { TsConfigJson } from "type-fest";

const tscPath = resolve('node_modules/.bin/tsc');

/**
 * Escape the slash `\` in ESC-symbol.
 * Use it to show by an error the received ESC sequence string in console output.
 */
export const esc = (string_: string): string => string_.replaceAll("", "\\x1b");

/**
 * Return output of javascript file.
 */
export const execScriptSync = (file: string, flags: string[] = [], environment: string[] = []): string => {
    const environmentVariables = environment.length > 0 ? `${environment.join(" ")} ` : "";
    const cmd = `cross-env ${environmentVariables}node ${file} ${flags.join(" ")}`;
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
    const tscProcess = await execa(tscPath, ["--showConfig"], { cwd });

    return JSON.parse(tscProcess.stdout);
};
