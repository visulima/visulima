import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";

import detectIndent from "detect-indent";
import type { PackageJson } from "read-pkg";

type ResolvedWriteOptions = {
    indent: number | string;
    newline: string;
};

const resolveWriteOptions = async (path: string, options: WriteOptions): Promise<ResolvedWriteOptions> => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const file = existsSync(path) ? await readFile(path, "utf8") : undefined;
    const indent = options.indent ?? (file ? detectIndent(file).indent : 2);
    const newline = options.newline === true ? "\n" : options.newline === false ? "" : options.newline ?? (file ? (file.endsWith("\n") ? "\n" : "") : "\n");

    return {
        indent,
        newline,
    };
};

export type WriteOptions = {
    indent?: number | string;
    newline?: boolean | string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const writeJsonFile = async (path: string, data: PackageJson & Record<string, any>, options: WriteOptions = {}): Promise<void> => {
    const resolvedOptions = await resolveWriteOptions(path, options);

    let content = JSON.stringify(data, undefined, resolvedOptions.indent);
    content += resolvedOptions.newline;

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await writeFile(path, content);
};
