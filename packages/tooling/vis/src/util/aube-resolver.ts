/**
 * TypeScript-side resolvers for the `aube` package manager.
 *
 * Aube is a standalone Rust CLI distributed via `npm i -g @endevco/aube`,
 * `mise`, or `brew`. Unlike pnpm/npm/yarn/bun (whose flag mappings live in
 * the NAPI binding), aube is resolved here in TS so the Rust addon does
 * not need to know about it. Once aube support lands in the native
 * binding, callers can switch over without touching the TS surface.
 *
 * Aube reads/writes pnpm/npm/yarn/bun lockfiles in place and supports
 * the `catalog:` protocol from `pnpm-workspace.yaml`, so it can act as
 * a drop-in installer for visulima itself.
 *
 * Flag mapping derived from `crates/aube/src/commands/*.rs` and the
 * global `Cli` args in `crates/aube/src/main.rs` at
 * github.com/endevco/aube. Globals (`--filter`, `--recursive`,
 * `--workspace-root`, `--silent`, `--frozen-lockfile`) are emitted
 * before the subcommand because `clap` accepts globals at any
 * position but conventional CLIs and tests are easier to read when
 * globals lead.
 */

import type {
    AddOptions,
    DlxOptions,
    ExecOptions,
    InstallOptions,
    OutdatedOptions,
    RemoveOptions,
    ResolvedCommand,
    WhyOptions,
} from "#native";

interface InfoOptions {
    fields: string[];
    json: boolean;
    package: string;
}

/**
 * Mirror of {@link import("../pm/package-manager").UpdateCommandOptions}.
 * Re-declared to keep `aube-resolver` independent of `package-manager`
 * (which only declares the type internally and is otherwise an
 * orthogonal module focused on the four conventional PMs).
 */
interface UpdateOptions {
    dev: boolean;
    filters: ReadonlyArray<string>;
    global: boolean;
    interactive: boolean;
    latest: boolean;
    noOptional: boolean;
    noSave: boolean;
    packages: ReadonlyArray<string>;
    prod: boolean;
    recursive: boolean;
    workspaceRoot: boolean;
}

/** Push global filters/recursive/workspace-root flags ahead of a subcommand. */
const pushFilterGlobals = (args: string[], filters: ReadonlyArray<string>, recursive: boolean, workspaceRoot: boolean): void => {
    for (const filter of filters) {
        args.push("--filter", filter);
    }

    if (recursive) {
        args.push("--recursive");
    }

    if (workspaceRoot) {
        args.push("--workspace-root");
    }
};

const resolveAubeInstall = (options: InstallOptions): ResolvedCommand => {
    const args: string[] = [];
    const warnings: string[] = [];

    pushFilterGlobals(args, options.filter, options.recursive, options.workspaceRoot);

    if (options.silent) {
        args.push("--silent");
    }

    if (options.frozenLockfile) {
        args.push("--frozen-lockfile");
    }

    args.push("install");

    if (options.dev) {
        args.push("--dev");
    }

    if (options.prod) {
        args.push("--prod");
    }

    if (options.force) {
        args.push("--force");
    }

    if (options.ignoreScripts) {
        // Aube already skips dependency lifecycle scripts by default, so
        // the flag is a no-op there. Pass it through so the resolved
        // command faithfully reflects vis's intent (and matches the
        // default block-by-default policy on every other PM); silently
        // not warning since the flag is now the universal vis default.
        args.push("--ignore-scripts");
    }

    if (options.lockfileOnly) {
        args.push("--lockfile-only");
    }

    if (options.noOptional) {
        args.push("--no-optional");
    }

    if (options.offline) {
        args.push("--offline");
    }

    return { args, bin: "aube", warnings };
};

const resolveAubeAdd = (options: AddOptions): ResolvedCommand => {
    const args: string[] = [];
    const warnings: string[] = [];

    pushFilterGlobals(args, options.filter, false, false);

    args.push("add");

    if (options.saveDev) {
        args.push("--save-dev");
    }

    if (options.exact) {
        args.push("--save-exact");
    }

    if (options.global) {
        args.push("--global");
    }

    if (options.optional) {
        args.push("--save-optional");
    }

    if (options.peer) {
        args.push("--save-peer");
    }

    if (options.workspace) {
        // `vis add --workspace` asks for the `workspace:` protocol (pnpm's
        // semantics: `pnpm add foo --workspace` pins to `workspace:^`).
        // Aube has no flag to force this — its `--workspace` is named the
        // same but means "operate at workspace root", which we already
        // emit below for `workspaceRoot`. Aube auto-detects workspace
        // members during add, so the flag is a no-op rather than a
        // failure.
        warnings.push(
            "aube has no flag for the `workspace:` protocol; it auto-detects local workspace members during add. Ignoring --workspace.",
        );
    }

    if (options.workspaceRoot) {
        // pnpm `-w` / `--workspace-root` ⇔ aube subcommand-level `-w` /
        // `--workspace` (both: redirect the add to the workspace root's
        // package.json). The naming collides with pnpm's `--workspace`
        // protocol flag but the source comment in
        // `crates/aube/src/commands/add.rs` confirms the semantic.
        args.push("--workspace");
    }

    args.push(...options.packages);

    return { args, bin: "aube", warnings };
};

const resolveAubeRemove = (options: RemoveOptions): ResolvedCommand => {
    const args: string[] = [];

    pushFilterGlobals(args, options.filter, options.recursive, false);

    args.push("remove");

    if (options.saveDev) {
        args.push("--save-dev");
    }

    if (options.global) {
        args.push("--global");
    }

    if (options.workspaceRoot) {
        args.push("--workspace");
    }

    args.push(...options.packages);

    return { args, bin: "aube", warnings: [] };
};

const resolveAubeDedupe = (check: boolean): ResolvedCommand => {
    const args: string[] = ["dedupe"];

    if (check) {
        args.push("--check");
    }

    return { args, bin: "aube", warnings: [] };
};

const resolveAubeWhy = (options: WhyOptions): ResolvedCommand => {
    const args: string[] = [];
    const warnings: string[] = [];

    pushFilterGlobals(args, options.filter, options.recursive, false);

    args.push("why");

    if (options.dev) {
        args.push("--dev");
    }

    if (options.prod) {
        args.push("--prod");
    }

    if (options.json) {
        args.push("--json");
    }

    if (options.long) {
        args.push("--long");
    }

    if (options.parseable) {
        args.push("--parseable");
    }

    if (options.depth !== undefined) {
        warnings.push("aube why does not accept --depth; ignoring.");
    }

    if (options.noOptional) {
        warnings.push("aube why does not accept --no-optional; ignoring.");
    }

    if (options.global) {
        warnings.push("aube why does not accept --global; ignoring.");
    }

    const [first, ...rest] = options.packages;

    if (first === undefined) {
        warnings.push("aube why requires a package name; none provided.");
    } else {
        if (rest.length > 0) {
            warnings.push("aube why takes a single package; using the first.");
        }

        args.push(first);
    }

    return { args, bin: "aube", warnings };
};

const resolveAubeOutdated = (options: OutdatedOptions): ResolvedCommand => {
    const args: string[] = [];
    const warnings: string[] = [];

    // Note: aube has no `--include-workspace-root` equivalent. vis's
    // `workspaceRoot=true` for outdated means "include root *alongside*
    // workspaces" (pnpm semantics). The aube global `--workspace-root`
    // would chdir to root and run outdated only against it, which is a
    // different report — drop the flag and warn instead.
    if (options.workspaceRoot) {
        warnings.push(
            "aube outdated has no `--include-workspace-root` equivalent. Run `vis outdated` separately at the workspace root if you need its outdated list.",
        );
    }

    pushFilterGlobals(args, options.filter, options.recursive, false);

    args.push("outdated");

    if (options.dev) {
        args.push("--dev");
    }

    if (options.prod) {
        args.push("--prod");
    }

    if (options.long) {
        args.push("--long");
    }

    if (options.format === "json") {
        args.push("--json");
    } else if (options.format && options.format !== "table") {
        warnings.push(`aube outdated does not support format "${options.format}"; falling back to default table output.`);
    }

    if (options.compatible) {
        warnings.push("aube outdated does not accept --compatible; ignoring.");
    }

    if (options.noOptional) {
        warnings.push("aube outdated does not accept --no-optional; ignoring.");
    }

    if (options.global) {
        warnings.push("aube outdated does not accept --global; ignoring.");
    }

    const [first, ...rest] = options.packages;

    if (first !== undefined) {
        if (rest.length > 0) {
            warnings.push("aube outdated takes a single pattern argument; using the first.");
        }

        args.push(first);
    }

    return { args, bin: "aube", warnings };
};

const resolveAubeDlx = (options: DlxOptions): ResolvedCommand => {
    const args: string[] = [];

    if (options.silent) {
        args.push("--silent");
    }

    args.push("dlx");

    for (const pkg of options.additionalPackages) {
        args.push("--package", pkg);
    }

    if (options.shellMode) {
        args.push("--shell-mode");
    }

    args.push(options.package);
    // `params: Vec<String>` with `trailing_var_arg = true, allow_hyphen_values = true`
    // captures everything after the package as-is, so we don't need a `--`.
    args.push(...options.args);

    return { args, bin: "aube", warnings: [] };
};

const resolveAubeExec = (options: ExecOptions): ResolvedCommand => {
    const args: string[] = [];

    pushFilterGlobals(args, options.filter, options.recursive, options.workspaceRoot);

    args.push("exec");

    if (options.parallel) {
        args.push("--parallel");
    }

    if (options.reverse) {
        args.push("--reverse");
    }

    if (options.shellMode) {
        args.push("--shell-mode");
    }

    args.push(options.command);
    args.push(...options.args);

    return { args, bin: "aube", warnings: [] };
};

const resolveAubeLink = (target: string | null): ResolvedCommand => {
    const args: string[] = ["link"];

    if (target !== null) {
        args.push(target);
    }

    return { args, bin: "aube", warnings: [] };
};

const resolveAubeUnlink = (packages: ReadonlyArray<string>, recursive: boolean): ResolvedCommand => {
    const args: string[] = [];
    const warnings: string[] = [];

    if (recursive) {
        args.push("--recursive");
    }

    args.push("unlink");

    if (packages.length > 1) {
        warnings.push("aube unlink takes a single package; using the first.");
    }

    if (packages.length > 0) {
        args.push(packages[0] as string);
    }

    return { args, bin: "aube", warnings };
};

const resolveAubeInfo = (options: InfoOptions): ResolvedCommand => {
    const args: string[] = ["view", "--", options.package];
    const warnings: string[] = [];
    const [first, ...rest] = options.fields;

    // `aube view` rejects `--json` together with a field; pick one.
    // Matches yarn-v1's existing precedence in `resolveInfo`: when the
    // user asks for a specific field they likely want that, not a JSON
    // dump of every field.
    if (first !== undefined) {
        if (rest.length > 0) {
            warnings.push("aube view only supports a single field; using the first.");
        }

        if (options.json) {
            warnings.push("aube view does not support --json with a field selector; printing the field without --json.");
        }

        args.push(first);
    } else if (options.json) {
        args.push("--json");
    }

    return { args, bin: "aube", warnings };
};

const resolveAubeUpdate = (options: UpdateOptions): { args: string[]; bin: "aube"; warnings: string[] } => {
    const args: string[] = [];
    const warnings: string[] = [];

    pushFilterGlobals(args, options.filters, options.recursive, options.workspaceRoot);

    args.push("update");

    if (options.dev) {
        args.push("--dev");
    }

    if (options.prod) {
        args.push("--prod");
    }

    if (options.global) {
        args.push("--global");
    }

    if (options.interactive) {
        args.push("--interactive");
    }

    if (options.latest) {
        args.push("--latest");
    }

    if (options.noOptional) {
        args.push("--no-optional");
    }

    if (options.noSave) {
        args.push("--no-save");
    }

    args.push(...options.packages);

    return { args, bin: "aube", warnings };
};

/**
 * Pass-through resolver for `vis pm &lt;subcommand> [args]`. Aube has
 * native subcommands for most PM utilities (cache, list, audit, view,
 * publish, login, logout, pack, dist-tag, rebuild, prune, deprecate),
 * so they forward verbatim. Commands that aube doesn't implement —
 * `fund`, `ping`, `search`, `token` — fall back to npm, matching the
 * existing pnpm/yarn/bun resolver behavior in
 * `native/src/pm_resolve.rs::resolve_pm_command`. This keeps
 * `vis pm &lt;thing>` semantics stable across installer choice.
 */
const NPM_ONLY_SUBCOMMANDS: ReadonlySet<string> = new Set(["fund", "ping", "search", "token"]);

const resolveAubePmCommand = (subcommand: string, extraArgs: ReadonlyArray<string>): ResolvedCommand => {
    if (NPM_ONLY_SUBCOMMANDS.has(subcommand)) {
        return {
            args: [subcommand, ...extraArgs],
            bin: "npm",
            warnings: [`'${subcommand}' is not natively supported by aube. Delegating to npm.`],
        };
    }

    return { args: [subcommand, ...extraArgs], bin: "aube", warnings: [] };
};

export {
    resolveAubeAdd,
    resolveAubeDedupe,
    resolveAubeDlx,
    resolveAubeExec,
    resolveAubeInfo,
    resolveAubeInstall,
    resolveAubeLink,
    resolveAubeOutdated,
    resolveAubePmCommand,
    resolveAubeRemove,
    resolveAubeUnlink,
    resolveAubeUpdate,
    resolveAubeWhy,
};
