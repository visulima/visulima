import { readFile } from "node:fs/promises";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";

import { R_OK } from "../constants";
import isAccessible from "../is-accessible";
import type { WriteJsonOptions } from "../types";
import writeFile from "./write-file";

const writeJson = async (path: URL | string, data: unknown, options: WriteJsonOptions = {}): Promise<void> => {
    const { detectIndent, indent: indentOption, replacer, stringify = JSON.stringify, ...writeOptions } = { indent: "\t", ...options };

    let indent = indentOption;
    let trailingNewline = "\n";

    if (await isAccessible(path, R_OK)) {
        try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const file = await readFile(path, "utf8");

            if (detectIndent) {
                const { indent: dIndent } = detectIndentFn(file);

                indent = dIndent as string;
            }

            trailingNewline = file.endsWith("\n") ? "\n" : "";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (error.code !== "ENOENT") {
                throw error;
            }
        }
    }

    // @ts-expect-error - `replacer` is a valid argument for `JSON.stringify`
    const json = stringify(data, replacer, indent);

    await writeFile(path, `${json}${trailingNewline}`, writeOptions);
};

export default writeJson;
