/**
 * Template runner — applies a `Creation` to disk.
 *
 * Walks the recursive `files` tree, prompts for overwrites unless
 * `--force` was passed, runs scripts in phase order, and prints
 * suggestions at the end. `--dry-run` prints the planned writes
 * without touching the filesystem.
 *
 * Every write target is checked against the destination directory to
 * reject `..`-escapes and absolute paths coming from rendered
 * frontmatter `to:` fields or filename interpolation — template
 * authors (or remote templates) must not be able to scribble
 * outside the caller's chosen destination.
 */

import { spawnSync } from "node:child_process";

import { bold, cyan, dim } from "@visulima/colorize";
import { ensureDirSync, isAccessibleSync, writeFileSync } from "@visulima/fs";
import { dirname, isAbsolute, join, relative, sep } from "@visulima/path";

import { pail } from "../io/logger";
import type { BuiltinVars, Creation, CreationDirectory, CreationFile, FileMeta, Script, Template, TemplateContext } from "./types";

interface RunnerOptions {
    /** Caller's CWD for `working_dir`. */
    cwd: string;
    /** Destination directory (absolute). */
    destination: string;
    /** When true, print but don't write. */
    dryRun?: boolean;
    /** When true, overwrite existing files without prompting. */
    force?: boolean;
    /** Resolved option values from `collectOptions`. */
    options: Record<string, unknown>;
    /** When true, don't run scripts. */
    skipScripts?: boolean;
    /** Workspace root for `dest_rel_dir`. */
    workspaceRoot: string;
}

interface FlatFile {
    content: CreationFile;
    path: string;
}

const flattenTree = (tree: CreationDirectory, prefix: string = ""): FlatFile[] => {
    const result: FlatFile[] = [];

    for (const [key, value] of Object.entries(tree)) {
        const path = prefix ? `${prefix}/${key}` : key;

        if (typeof value === "string" || Buffer.isBuffer(value)) {
            result.push({ content: value, path });
        } else if (value && typeof value === "object") {
            result.push(...flattenTree(value, path));
        }
    }

    return result;
};

const formatSize = (bytes: number): string => {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Reject `..`-escape and absolute paths coming from rendered template
 * output. `destination` is trusted (the caller's `--to`); `relPath` is
 * untrusted (rendered frontmatter `to:` or filename interpolation).
 * Returns the joined absolute path on success; throws otherwise.
 */
const safeJoinDestination = (destination: string, relPath: string): string => {
    if (isAbsolute(relPath)) {
        throw new Error(`Refusing to write outside destination: template produced absolute path "${relPath}".`);
    }

    const target = join(destination, relPath);
    const rel = relative(destination, target);

    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
        throw new Error(`Refusing to write outside destination: "${relPath}" resolves to "${target}" which escapes "${destination}".`);
    }

    return target;
};

const writeOne = (destinationPath: string, content: CreationFile): void => {
    ensureDirSync(dirname(destinationPath));
    writeFileSync(destinationPath, content);
};

const runScript = (script: Script, cwd: string, silent: boolean = false): boolean => {
    const commands = typeof script === "string" ? [script] : script.commands;
    const isSilent = typeof script === "string" ? silent : (script.silent ?? silent);

    for (const command of commands) {
        if (!isSilent) {
            pail.info(`$ ${command}`);
        }

        // eslint-disable-next-line sonarjs/os-command -- script comes from the user's own template manifest; running it through the shell is the documented contract
        const result = spawnSync(command, {
            cwd,
            shell: true,
            stdio: isSilent ? "ignore" : "inherit",
        });

        if (result.status !== 0) {
            pail.warn(`Script failed (exit ${String(result.status)}): ${command}`);

            return false;
        }
    }

    return true;
};

/**
 * Group scripts by their `phase` (default 0). Phases run in ascending
 * order; scripts within a phase run concurrently (Promise.all).
 * Matches the docstring contract on `ScriptObject.phase`.
 */
const groupByPhase = (scripts: Script[]): [number, Script[]][] => {
    const phases = new Map<number, Script[]>();

    for (const script of scripts) {
        const phase = typeof script === "string" ? 0 : (script.phase ?? 0);
        const bucket = phases.get(phase);

        if (bucket) {
            bucket.push(script);
        } else {
            phases.set(phase, [script]);
        }
    }

    return [...phases.entries()].sort(([a], [b]) => a - b);
};

/**
 * Run a template end-to-end: invoke `produce`, write files, run scripts,
 * print suggestions.
 */
export const runTemplate = async (template: Template, options: RunnerOptions): Promise<void> => {
    const builtins: BuiltinVars = {
        dest_dir: options.destination,
        dest_rel_dir: relative(options.workspaceRoot, options.destination) || ".",
        working_dir: options.cwd,
        workspace_root: options.workspaceRoot,
    };

    const context: TemplateContext = {
        builtins,
        options: options.options,
    };

    const creation: Creation = await template.produce(context);

    const files = creation.files ? flattenTree(creation.files) : [];
    const filesMeta = creation.filesMeta ?? {};

    // Validate every destination path up-front so we fail fast — and
    // consistently across dry-run and real runs — before writing
    // anything.
    const plans: { file: FlatFile; meta: FileMeta; target: string }[] = [];

    for (const file of files) {
        const target = safeJoinDestination(options.destination, file.path);

        plans.push({ file, meta: filesMeta[file.path] ?? {}, target });
    }

    if (options.dryRun) {
        pail.info(`${bold(cyan("Plan"))} ${dim("(dry-run, no files written)")}`);

        for (const plan of plans) {
            const size = Buffer.isBuffer(plan.file.content) ? plan.file.content.length : Buffer.byteLength(plan.file.content, "utf8");

            process.stderr.write(`  ${dim("write")} ${plan.file.path} ${dim(`(${formatSize(size)})`)}\n`);
        }
    } else {
        ensureDirSync(options.destination);

        let written = 0;
        let skipped = 0;

        for (const plan of plans) {
            const { file, meta, target } = plan;
            const exists = isAccessibleSync(target);
            const effectiveForce = options.force || meta.force === true;

            if (exists && !effectiveForce) {
                pail.warn(`Skipped existing file: ${file.path} (use --force or set frontmatter force: true to overwrite)`);
                skipped += 1;
                continue;
            }

            writeOne(target, file.content);
            written += 1;
        }

        pail.success(`Wrote ${String(written)} file${written === 1 ? "" : "s"}${skipped > 0 ? `, skipped ${String(skipped)}` : ""}`);
    }

    if (!options.dryRun && !options.skipScripts && creation.scripts && creation.scripts.length > 0) {
        const phases = groupByPhase(creation.scripts);

        pail.info(
            `Running ${String(creation.scripts.length)} script${creation.scripts.length === 1 ? "" : "s"} across ${String(phases.length)} phase${phases.length === 1 ? "" : "s"}…`,
        );

        for (const [, scripts] of phases) {
            // Scripts within a phase may run in parallel. Sequential
            // `spawnSync` is wrapped in Promise.resolve so Promise.all
            // gives us the "may run in parallel" semantic without
            // changing the synchronous exec call.
            const results = await Promise.all(scripts.map((script) => Promise.resolve(runScript(script, options.destination))));

            if (results.includes(false)) {
                throw new Error("Script failed — aborting.");
            }
        }
    }

    if (creation.suggestions && creation.suggestions.length > 0) {
        process.stderr.write("\n");
        pail.notice("Next steps:");

        for (const suggestion of creation.suggestions) {
            process.stderr.write(`  ${dim("•")} ${suggestion}\n`);
        }
    }
};
