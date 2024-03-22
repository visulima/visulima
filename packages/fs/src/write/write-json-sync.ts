import { readFileSync } from "node:fs";

// eslint-disable-next-line import/no-extraneous-dependencies
import detectIndentFn from "detect-indent";

import { R_OK } from "../constants";
import isAccessibleSync from "../is-accessible-sync";
import type { WriteJsonOptions } from "../types";
import writeFileSync from "./write-file-sync";

const writeJsonSync = (path: URL | string, data: unknown, options: WriteJsonOptions = {}): void => {
    const { detectIndent, indent: indentOption, replacer, stringify = JSON.stringify, ...writeOptions } = { indent: "\t", ...options };

    let indent = indentOption;
    let trailingNewline = "\n";

    if (isAccessibleSync(path, R_OK)) {
        try {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            const file = readFileSync(path, "utf8");

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

    writeFileSync(path, `${json}${trailingNewline}`, writeOptions);
};

export default writeJsonSync;
