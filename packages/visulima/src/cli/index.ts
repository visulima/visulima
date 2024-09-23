// eslint-disable-next-line import/no-unused-modules,import/no-named-as-default
import Cli from "@visulima/cerebro";
import { SimpleReporter } from "@visulima/pail/reporter";

import { name, version } from "../../package.json";
// eslint-disable-next-line unicorn/prevent-abbreviations
import createDevCommand from "./dev";

/**
 * Create a new instance of the packem CLI.
 *
 * @type {Cli}
 */
const cli = new Cli("packem", {
    logger: {
        reporters: [
            new SimpleReporter({
                error: {
                    hideErrorCauseCodeView: true,
                    hideErrorCodeView: true,
                    hideErrorErrorsCodeView: true,
                },
            }),
        ],
        scope: "packem",
    },
    packageName: name,
    packageVersion: version,
});

createDevCommand(cli);

// eslint-disable-next-line no-void
void cli.run({
    shouldExitProcess: false,
});
