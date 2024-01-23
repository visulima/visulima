import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

const fixCjsDFiles = (pkg) => {
    if (file.name.endsWith(pkg?.type === "module" ? ".d.cts" : ".d.ts")) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = readFileSync(filePath, "utf8");

        const exportRegex = /export \{\s*(?:\S.*)?\b(?<name>.+) as default.*(?:[\n\r\u{2028}\u{2029}]\s*)?\};/u;
        const result = exportRegex.exec(content);

        if (result?.groups?.name) {
            let newContent = content.replace(/_default as default,/g, "");

            newContent = newContent + `\nexport = ${result.groups.name}`;

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            writeFileSync(filePath, newContent, "utf8");
        } else {
            let newContent = content.replace(/_default as default,/g, "");

            newContent = newContent + `\nexport = _default`;

            // eslint-disable-next-line security/detect-non-literal-fs-filename
            writeFileSync(filePath, newContent, "utf8");
        }
    }
};
