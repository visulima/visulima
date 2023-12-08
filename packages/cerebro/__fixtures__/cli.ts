import Cli from "../src";
import type { Toolbox as IToolbox } from "../src/@types";

/**
 * Create the cli and kick it off
 */
// eslint-disable-next-line import/prefer-default-export,func-style
export async function run(argv?: string[]): Promise<void> {
    // create a CLI runtime
    const cerebro = new Cli("cerebro", { argv: argv ?? process.argv, packageName: "@visulima/cerebro", packageVersion: "0.0.0" });

    cerebro.addCommand({
        execute: async (toolbox: IToolbox) => {
            const { logger, runtime } = toolbox;
            logger.info(`cerebro version ${runtime.getPackageVersion()}`);
            logger.info(``);
            logger.info(`  Type cerebro --help for more info`);
        },
        name: "test",
    });

    // and execute it
    await cerebro.run();
}
