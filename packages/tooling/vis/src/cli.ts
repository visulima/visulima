import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createCerebro as createCli } from "@visulima/cerebro";
import { dirname, join } from "@visulima/path";

import { affectedCommand } from "./commands/affected";
import { graphCommand } from "./commands/graph";
import { runCommand } from "./commands/run";

const loadPackageVersion = (): string => {
    try {
        const packageDir = dirname(fileURLToPath(import.meta.url));
        const packageJsonPath = join(packageDir, "..", "package.json");
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version: string };

        return pkg.version;
    } catch {
        return "0.0.0";
    }
};

const createCerebro = () => {
    const cli = createCli("vis", {
        packageName: "@visulima/vis",
        packageVersion: loadPackageVersion(),
    });

    cli.addCommand(runCommand);
    cli.addCommand(graphCommand);
    cli.addCommand(affectedCommand);

    return cli;
};

export { createCerebro };
