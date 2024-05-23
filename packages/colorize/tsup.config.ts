import { join } from "@visulima/path";
import { readFileSync, writeFileSync } from "fs";

import { createConfig } from "../../tools/get-tsup-config";

const replaceCjsExports = () => {
    return {
        buildEnd(result) {
            try {
                result.writtenFiles.forEach((file) => {
                    const filePath = join(process.cwd(), file.name);

                    if (file.name.endsWith(".cjs")) {
                        // eslint-disable-next-line security/detect-non-literal-fs-filename
                        const content = readFileSync(filePath, "utf8");

                        const split = content.split("\n");

                        const colorizeExportIndex = split.findIndex((line) => line.includes("exports.Colorize"));
                        const defaultExportIndex = split.findIndex((line) => line.includes("module.exports"));

                        const defaultExport = split[defaultExportIndex];
                        const colorizeExport = split[colorizeExportIndex];

                        split[colorizeExportIndex] = defaultExport;
                        split[defaultExportIndex] = colorizeExport.replace("exports", "module.exports");

                        // eslint-disable-next-line security/detect-non-literal-fs-filename
                        writeFileSync(filePath, split.join("\n"), "utf8");
                    }
                });
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(error);
            }
        },
        name: "replace-cjs-exports",
    };
};

const config = createConfig({
    cjs: {
        shims: false,
        plugins: [replaceCjsExports()],
    },
    esm: {
        shims: false,
    },
});

export default config;
