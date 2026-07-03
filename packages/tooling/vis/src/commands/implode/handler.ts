import { homedir } from "node:os";
import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { getVisHomeDir } from "../../util/vis-paths";
import type { ImplodeOptions } from "./index";

const VIS_HOME = getVisHomeDir();

const SHELL_PROFILES = [
    join(homedir(), ".zshrc"),
    join(homedir(), ".zshenv"),
    join(homedir(), ".bashrc"),
    join(homedir(), ".bash_profile"),
    join(homedir(), ".profile"),
    join(homedir(), ".config", "fish", "config.fish"),
];

/**
 * Remove lines containing vis markers from shell profiles.
 */
const cleanShellProfiles = (logger: Console): string[] => {
    const cleaned: string[] = [];

    for (const profile of SHELL_PROFILES) {
        if (!isAccessibleSync(profile)) {
            continue;
        }

        try {
            const content: string = readFileSync(profile);
            const lines = content.split("\n");
            const filtered = lines.filter((line) => !line.includes(".vis/bin") && !line.includes("VIS_HOME") && !line.includes("# vis "));

            if (filtered.length !== lines.length) {
                writeFileSync(profile, filtered.join("\n"));
                cleaned.push(profile);
            }
        } catch {
            logger.warn(`warning: could not clean ${profile}`);
        }
    }

    return cleaned;
};

const execute = async ({ fs, logger, options }: Toolbox<Console, ImplodeOptions>): Promise<void> => {
    if (!isAccessibleSync(VIS_HOME)) {
        logger.info("vis is not installed (no ~/.vis directory found).");

        return;
    }

    logger.info("This will remove:");
    logger.info(`  ${VIS_HOME}/`);

    const shellFiles = SHELL_PROFILES.filter((p) => isAccessibleSync(p) && readFileSync(p).includes(".vis"));

    for (const file of shellFiles) {
        logger.info(`  Lines in ${file}`);
    }

    if (!options.yes) {
        if (!process.stdin.isTTY) {
            throw new Error("Non-interactive terminal. Use --yes to confirm.");
        }

        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise<string>((resolve) => {
            rl.question("\nType \"uninstall\" to confirm: ", resolve);
        });

        rl.close();

        if (answer.trim() !== "uninstall") {
            logger.info("Aborted.");

            return;
        }
    }

    // Clean shell profiles (non-fatal)
    const cleaned = cleanShellProfiles(logger);

    for (const file of cleaned) {
        logger.info(`Cleaned ${file}`);
    }

    // Remove installation directory
    try {
        await fs.rm(VIS_HOME, { force: true, recursive: true });
        logger.info(`\n✓ Removed ${VIS_HOME}`);
    } catch (error: unknown) {
        throw new Error(`Failed to remove ${VIS_HOME}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    logger.info("✓ vis has been uninstalled.");
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
