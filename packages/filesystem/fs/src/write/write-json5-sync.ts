import { readFileSync } from "node:fs";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";
import JSON5 from "json5";

import { R_OK } from "../constants";
import isAccessibleSync from "../is-accessible-sync";
import type { WriteJson5Options } from "../types";
import writeFileSync from "./write-file-sync";

/**
 * Synchronously writes a value to a JSON5 file.
 * @param path The path to the JSON5 file. Can be a file URL or a string path.
 * @param data The data to serialize.
 * @param options Optional configuration. See {@link WriteJson5Options}.
 * @example
 * ```javascript
 * import { writeJson5Sync } from "@visulima/fs/json5";
 *
 * writeJson5Sync("./config.json5", { name: "app" }, { indent: 2 });
 * ```
 */
const writeJson5Sync = (path: URL | string, data: unknown, options: WriteJson5Options = {}): void => {
    const { detectIndent, indent: indentOption, quote, replacer, ...writeOptions } = { indent: "\t", ...options };

    let indent = indentOption;
    let trailingNewline = "\n";

    if (isAccessibleSync(path, R_OK)) {
        try {
            const file = readFileSync(path, "utf8");

            if (detectIndent) {
                const { indent: detectedIndent } = detectIndentFn(file);

                if (detectedIndent) {
                    indent = detectedIndent;
                }
            }

            trailingNewline = file.endsWith("\n") ? "\n" : "";
        } catch (error: unknown) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
                throw error;
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output = JSON5.stringify(data, { quote, replacer: replacer as any, space: indent });

    writeFileSync(path, `${output}${trailingNewline}`, writeOptions);
};

export default writeJson5Sync;
