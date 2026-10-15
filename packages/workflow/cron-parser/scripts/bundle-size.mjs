// Bundles and minifies a few typical imports of the built package and prints their size, so the figures in the
// README can be reproduced: `pnpm run build:prod && pnpm run size`.
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));

const cases = {
    "parse and iterate": 'import { parse } from "@visulima/cron-parser"; export default parse("0 9 * * *", { tz: "Europe/Berlin" }).next();',
    "a date on its own": 'import { CronDate } from "@visulima/cron-parser"; export default new CronDate("2021-01-01T00:00:00Z", "UTC");',
    "everything in the main entry": 'import * as everything from "@visulima/cron-parser"; export default everything;',
    "the crontab reader": 'import { parseFile } from "@visulima/cron-parser/file"; export default parseFile;',
};

const rows = [];

for (const [name, contents] of Object.entries(cases)) {
    const { outputFiles } = await build({
        alias: { "@visulima/cron-parser": `${root}dist/index.js`, "@visulima/cron-parser/file": `${root}dist/file.js` },
        bundle: true,
        logLevel: "error",
        external: ["node:*"],
        format: "esm",
        minify: true,
        platform: "neutral",
        stdin: { contents, loader: "js", resolveDir: root },
        write: false,
    });
    const code = outputFiles[0].contents;
    const nodeImports = [...new TextDecoder().decode(code).matchAll(/node:[a-z/]+/g)].map((match) => match[0]);

    rows.push({
        "gzipped (bytes)": gzipSync(code).length,
        "imports of node:*": [...new Set(nodeImports)].join(", ") || "none",
        "minified (bytes)": code.length,
        name,
    });
}

console.table(rows);
