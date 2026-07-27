import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { VisUserError } from "../../errors/vis-user-error";
import { selectAffectedProjects } from "../../task/affected-selection";
import { filterProjectsByQuery, filterProjectsByTags } from "../../task/selectors";
import type { AffectedCommandOptions } from "./index";

/**
 * Everything after the `affected` token in the real argv.
 *
 * Forwarded verbatim to `vis run` rather than re-enumerated flag by flag.
 * The enumerate-and-forward approach is exactly the bug this command's own
 * PR set out to kill: it forwarded six of `vis run`'s ~40 options, so
 * `vis affected build --fail-fast` (or `--summarize`, `--log`,
 * `--strict-env`, `--output-style`, …) parsed fine and silently did
 * nothing. Passing the tokens through means the list can never drift as
 * `run` grows.
 *
 * Located by scanning for the command token instead of a fixed offset so
 * global options placed before it (`vis --cwd=… affected build`) survive.
 * @param argv Full process argv.
 * @returns The user's tokens for this invocation.
 */
export const forwardedArgv = (argv: ReadonlyArray<string>): string[] => {
    const commandIndex = argv.indexOf("affected", 2);

    return commandIndex === -1 ? [] : argv.slice(commandIndex + 1);
};

const execute = async ({ argument, options, runtime, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AffectedCommandOptions>): Promise<void> => {
    const target = argument[0];

    if (!target) {
        throw new VisUserError("Missing target. Usage: vis affected <target>");
    }

    if (!wsRoot) {
        throw new VisUserError("Could not determine workspace root. Run this command inside a monorepo.");
    }

    // `--sparse-checkout` is the one thing this command does that `vis run`
    // cannot: it prints project roots and exits without running anything.
    // Everything else is `vis run --affected` with the same flags, so hand
    // over rather than maintaining a second copy of the filter pipeline.
    if (options.sparseCheckout) {
        const workspaceRoot = wsRoot;
        const { packageJsons, workspace } = discoverWorkspace(workspaceRoot, visConfig);
        const projectGraph = buildProjectGraph(workspaceRoot, workspace, packageJsons);

        const result = await selectAffectedProjects(
            {
                base: options.base,
                downstream: options.downstream,
                head: options.head,
                uncommitted: options.uncommitted,
                upstream: options.upstream,
            },
            { projectGraph, projects: workspace.projects, workspaceRoot },
            { defaultBase: visConfig?.defaultBase },
        );

        let affectedProjects = filterProjectsByQuery(result.affectedProjects, workspace, options.query);

        affectedProjects = filterProjectsByTags(affectedProjects, workspace, options.tag);

        // Emit one project root per line, deduped and sorted, so the output
        // pipes straight into `git sparse-checkout set --stdin`. Only paths
        // go to stdout; nothing else is logged so the pipe stays clean.
        // Falls back to the project name when a project declares no root
        // (it doubles as the directory by convention).
        const roots = [...new Set(affectedProjects.map((name) => workspace.projects[name]?.root ?? name))].sort();

        process.stdout.write(roots.length > 0 ? `${roots.join("\n")}\n` : "");

        return;
    }

    const argv = forwardedArgv(process.argv);

    await runtime.runCommand("run", { argv: argv.includes("--affected") ? argv : [...argv, "--affected"] });
};

export default execute as CommandExecute<Toolbox>;
