import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import type { RunOptions, StagedConfig } from "../../staged";
import { runStaged } from "../../staged";
import { CONCURRENT_ENV_VAR, parseConcurrent } from "../../staged/cli-parse";
import type { StagedOptions } from "./index";

type MutableRunOptions = { -readonly [K in keyof RunOptions]: RunOptions[K] };

/**
 * Translates the cerebro-parsed CLI options (kebab-case keys, string/boolean values)
 * into a strongly-typed `RunOptions` object. Only the flags the user passed are
 * forwarded — the rest fall through to `runStaged`'s own defaults.
 */
export const buildRunOptions = (raw: Record<string, unknown>, stagedConfig: StagedConfig | undefined): RunOptions => {
    const options: MutableRunOptions = {};

    if (stagedConfig !== undefined) {
        options.config = stagedConfig;
    }

    const readBool = (key: string): boolean | undefined => (raw[key] === undefined ? undefined : Boolean(raw[key]));
    const readString = (key: string): string | undefined => {
        const value = raw[key];

        return typeof value === "string" && value.length > 0 ? value : undefined;
    };

    const allowEmpty = readBool("allow-empty");

    if (allowEmpty !== undefined) {
        options.allowEmpty = allowEmpty;
    }

    const autoStage = readBool("auto-stage");

    if (autoStage !== undefined) {
        options.autoStage = autoStage;
    }

    const continueOnError = readBool("continue-on-error");

    if (continueOnError !== undefined) {
        options.continueOnError = continueOnError;
    }

    const debug = readBool("debug");

    if (debug !== undefined) {
        options.debug = debug;
    }

    const failOnChanges = readBool("fail-on-changes");

    if (failOnChanges !== undefined) {
        options.failOnChanges = failOnChanges;
    }

    const hidePartiallyStaged = readBool("hide-partially-staged");

    if (hidePartiallyStaged !== undefined) {
        options.hidePartiallyStaged = hidePartiallyStaged;
    }

    const hideUnstaged = readBool("hide-unstaged");

    if (hideUnstaged !== undefined) {
        options.hideUnstaged = hideUnstaged;
    }

    const quiet = readBool("quiet");

    if (quiet !== undefined) {
        options.quiet = quiet;
    }

    const relative = readBool("relative");

    if (relative !== undefined) {
        options.relative = relative;
    }

    const revert = readBool("revert");

    if (revert !== undefined) {
        options.revert = revert;
    }

    const stash = readBool("stash");

    if (stash !== undefined) {
        options.stash = stash;
    }

    const verbose = readBool("verbose");

    if (verbose !== undefined) {
        options.verbose = verbose;
    }

    const cwd = readString("cwd");

    if (cwd !== undefined) {
        options.cwd = cwd;
    }

    const diff = readString("diff");

    if (diff !== undefined) {
        options.diff = diff;
    }

    const diffFilter = readString("diff-filter");

    if (diffFilter !== undefined) {
        options.diffFilter = diffFilter;
    }

    // `--force-kill` is a boolean shorthand for `killSignal: "SIGKILL"`. Users with more exotic
    // requirements can supply `killSignal` directly via the programmatic API.
    const forceKill = readBool("force-kill");

    if (forceKill === true) {
        options.killSignal = "SIGKILL";
    }

    if (raw["concurrent"] === undefined) {
        const envValue = process.env[CONCURRENT_ENV_VAR];

        if (envValue !== undefined) {
            options.concurrent = parseConcurrent(envValue.trim());
        }
    } else {
        const { concurrent } = raw;

        options.concurrent = parseConcurrent(typeof concurrent === "string" ? concurrent : typeof concurrent === "number" || typeof concurrent === "boolean" ? String(concurrent) : "");
    }

    return options;
};

const execute = async ({ options, visConfig }: Toolbox<Console, StagedOptions>): Promise<void> => {
    const config = (visConfig ?? {}) as Record<string, unknown>;
    const stagedConfig = config["staged"] as StagedConfig | undefined;

    if (!stagedConfig) {
        throw new Error(
            'No "staged" config found in vis.config.ts. Add one:\n\n'
            + "  // vis.config.ts\n"
            + '  import { defineConfig } from "@visulima/vis/config";\n\n'
            + "  export default defineConfig({\n"
            + "    staged: { '*': 'vis check --fix' },\n"
            + "  });\n\n"
            + "Migrating from lint-staged or nano-staged? Run `vis migrate lint-staged`"
            + " (or `vis migrate nano-staged`) to move the config in and remove the legacy files.",
        );
    }

    const result = await runStaged(buildRunOptions(options, stagedConfig));

    if (!result.success) {
        process.exitCode = 1;
    }
};

export default execute as CommandExecute<Toolbox>;
