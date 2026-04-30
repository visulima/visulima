import { resolveAubeUpdate } from "../util/aube-resolver";

interface UpdateCommandOptions {
    dev: boolean;
    filters: string[];
    global: boolean;
    interactive: boolean;
    latest: boolean;
    noOptional: boolean;
    noSave: boolean;
    packages: string[];
    prod: boolean;
    recursive: boolean;
    workspaceRoot: boolean;
}

interface ResolvedCommand {
    args: string[];
    bin: string;
}

const resolvePnpm = (options: UpdateCommandOptions): ResolvedCommand => {
    const args: string[] = [];

    for (const filter of options.filters) {
        args.push("--filter", filter);
    }

    if (options.workspaceRoot) {
        args.push("--filter", ".");
    }

    args.push("update");

    if (options.latest) {
        args.push("--latest");
    }

    if (options.recursive) {
        args.push("--recursive");
    }

    if (options.interactive) {
        args.push("--interactive");
    }

    if (options.dev) {
        args.push("--dev");
    }

    if (options.prod) {
        args.push("--prod");
    }

    if (options.noOptional) {
        args.push("--no-optional");
    }

    if (options.noSave) {
        args.push("--no-save");
    }

    args.push(...options.packages);

    return { args, bin: "pnpm" };
};

const resolveYarnV1 = (options: UpdateCommandOptions): ResolvedCommand => {
    const args: string[] = [];

    if (options.filters.length > 0) {
        args.push("workspace", options.filters[0] as string);
    }

    args.push("upgrade");

    if (options.latest) {
        args.push("--latest");
    }

    args.push(...options.packages);

    return { args, bin: "yarn" };
};

const resolveYarnBerry = (options: UpdateCommandOptions): ResolvedCommand => {
    const args: string[] = [];

    if (options.filters.length > 0 || options.recursive) {
        args.push("workspaces", "foreach", "--all");

        for (const filter of options.filters) {
            args.push("--include", filter);
        }
    }

    args.push("up");

    if (options.interactive) {
        args.push("--interactive");
    }

    args.push(...options.packages);

    return { args, bin: "yarn" };
};

const resolveNpm = (options: UpdateCommandOptions, warnings: string[]): ResolvedCommand => {
    const args: string[] = ["update"];

    if (options.latest) {
        warnings.push("npm does not support --latest flag. Packages will be updated within their semver range.");
    }

    if (options.interactive) {
        warnings.push("npm does not support --interactive mode.");
    }

    for (const filter of options.filters) {
        args.push("--workspace", filter);
    }

    if (options.recursive) {
        args.push("--workspaces");
    }

    if (options.workspaceRoot) {
        args.push("--include-workspace-root");
    }

    if (options.dev) {
        args.push("--dev");
    }

    if (options.prod) {
        args.push("--production");
    }

    if (options.noOptional) {
        args.push("--no-optional");
    }

    if (options.noSave) {
        args.push("--no-save");
    }

    args.push(...options.packages);

    return { args, bin: "npm" };
};

const resolveBun = (options: UpdateCommandOptions): ResolvedCommand => {
    const args: string[] = ["update"];

    if (options.latest) {
        args.push("--latest");
    }

    for (const filter of options.filters) {
        args.push("--filter", filter);
    }

    args.push(...options.packages);

    return { args, bin: "bun" };
};

const resolveUpdateCommand = (
    packageManager: "aube" | "bun" | "npm" | "pnpm" | "yarn",
    version: string,
    options: UpdateCommandOptions,
): { command: ResolvedCommand; warnings: string[] } => {
    const warnings: string[] = [];

    // Global updates always use npm — except for aube, which has its own
    // `aube update --global` that operates on the aube global store.
    if (options.global && packageManager !== "aube") {
        const args = ["update", "--global", ...options.packages];

        return { command: { args, bin: "npm" }, warnings };
    }

    let command: ResolvedCommand;

    switch (packageManager) {
        case "aube": {
            // Delegate to the shared aube resolver so flag mapping stays
            // single-sourced. The returned `warnings` flow up via the
            // outer `warnings` array.
            const aube = resolveAubeUpdate(options);

            command = { args: aube.args, bin: aube.bin };
            warnings.push(...aube.warnings);

            break;
        }

        case "bun": {
            command = resolveBun(options);
            break;
        }

        case "npm": {
            command = resolveNpm(options, warnings);
            break;
        }

        case "pnpm": {
            command = resolvePnpm(options);
            break;
        }

        case "yarn": {
            command = version.startsWith("1.") ? resolveYarnV1(options) : resolveYarnBerry(options);

            break;
        }

        default: {
            const exhaustiveCheck: never = packageManager;

            throw new Error(`Unsupported package manager: ${String(exhaustiveCheck)}`);
        }
    }

    return { command, warnings };
};

export type { ResolvedCommand, UpdateCommandOptions };
export { resolveUpdateCommand };
