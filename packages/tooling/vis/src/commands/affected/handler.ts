import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { buildProjectGraph, discoverWorkspace } from "../../config/workspace";
import { VisUserError } from "../../errors/vis-user-error";
import { selectAffectedProjects } from "../../task/affected-selection";
import { filterProjectsByQuery, filterProjectsByTags } from "../../task/selectors";
import type { AffectedCommandOptions } from "./index";

/**
 * The tokens this invocation was given, to forward verbatim to `vis run`.
 *
 * Forwarded rather than re-enumerated flag by flag. The
 * enumerate-and-forward approach is exactly the bug this command's own PR
 * set out to kill: it forwarded six of `vis run`'s ~40 options, so
 * `vis affected build --fail-fast` (or `--summarize`, `--log`,
 * `--strict-env`, `--output-style`, …) parsed fine and silently did
 * nothing. Passing the tokens through means the list can never drift as
 * `run` grows.
 *
 * `rawArgv` is authoritative: it is what the caller supplied, whether that
 * caller was the shell or `runtime.runCommand()`. The argv scan is only a
 * fallback for hosts predating `rawArgv`, and it locates the tokens by
 * command name rather than a fixed offset so global options placed before
 * it survive.
 *
 * The scan used to be the only path, and it silently broke every
 * programmatic caller — `vis ci lint` reaches this command through
 * `runCommand`, where the real argv holds no `affected` token at all. The
 * scan returned `[]`, `vis run` was handed no target, printed its usage
 * text, and `vis ci` reported success: a CI job that verified nothing and
 * went green.
 * @param rawArgv Tokens this command was invoked with.
 * @param argv Full process argv, used only as a fallback.
 * @returns The user's tokens for this invocation.
 */
export const forwardedArgv = (rawArgv: ReadonlyArray<string>, argv: ReadonlyArray<string>): string[] => {
    if (rawArgv.length > 0) {
        return [...rawArgv];
    }

    const commandIndex = argv.indexOf("affected", 2);

    return commandIndex === -1 ? [] : argv.slice(commandIndex + 1);
};

const execute = async ({ argument, options, rawArgv, runtime, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, AffectedCommandOptions>): Promise<void> => {
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

    const argv = forwardedArgv(rawArgv ?? [], process.argv);

    // Belt-and-braces: handing `vis run` an empty argv makes it print its
    // target list and return 0, which reads as a passing job.
    if (argv.length === 0) {
        throw new VisUserError("Missing target. Usage: vis affected <target>");
    }

    await runtime.runCommand("run", { argv: argv.includes("--affected") ? argv : [...argv, "--affected"] });
};

export default execute as CommandExecute<Toolbox>;
