import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

import { dirname, join } from "@visulima/path";
import { parseDocument } from "yaml";

import type { LockfilePackageManager } from "./lockfile";
import { detectPackageManager } from "./lockfile";

/** The proprietary vite+ client whose calls no-op under this runner. */
const VITE_CLIENT = "@voidzero-dev/vite-task-client";
/** Our drop-in replacement that speaks the runner's hint protocol. */
const OUR_CLIENT = "@visulima/task-runner-client";
/** Alias value written into the override map. */
const ALIAS = `npm:${OUR_CLIENT}@^1`;
/** Marker (relative to workspace root) recording a user "no" so we ask once. */
const DECLINE_MARKER = join(".vis", ".vite-client-override-declined");
/** pnpm's workspace config — the modern home for `overrides` (pnpm v10+). */
const PNPM_WORKSPACE_FILE = "pnpm-workspace.yaml";

const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const;

/** The dependency-bearing slice of a package.json we care about. */
export interface DependencyManifest {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

interface PackageJson extends DependencyManifest {
    overrides?: Record<string, string>;
    pnpm?: { overrides?: Record<string, string> };
    resolutions?: Record<string, string>;
}

const readPackageJson = (path: string): PackageJson | undefined => {
    try {
        return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
    } catch {
        return undefined;
    }
};

/**
 * Reads the `overrides` map from `pnpm-workspace.yaml`, or `undefined`
 * when the file is absent / unparseable / has no overrides block.
 */
const readPnpmWorkspaceOverrides = (workspaceRoot: string): Record<string, unknown> | undefined => {
    const yamlPath = join(workspaceRoot, PNPM_WORKSPACE_FILE);

    if (!existsSync(yamlPath)) {
        return undefined;
    }

    try {
        const parsed = parseDocument(readFileSync(yamlPath, "utf8")).toJS() as { overrides?: Record<string, unknown> } | null;

        return parsed?.overrides;
    } catch {
        return undefined;
    }
};

/**
 * Picks the `package.json` field each package manager reads for
 * overrides: `pnpm`/`aube` use nested `pnpm.overrides`, yarn uses
 * `resolutions`, everything else uses top-level `overrides`. pnpm/aube
 * only reach this when no `pnpm-workspace.yaml` exists to host the entry.
 */
const overrideFieldFor = (manager: LockfilePackageManager): "overrides" | "pnpm.overrides" | "resolutions" => {
    if (manager === "pnpm" || manager === "aube") {
        return "pnpm.overrides";
    }

    if (manager === "yarn") {
        return "resolutions";
    }

    return "overrides";
};

/**
 * Adds the alias to `pnpm-workspace.yaml`'s `overrides` block via the
 * `yaml` document API, preserving the file's existing comments and key
 * order. Returns `true` on success.
 */
const writeToPnpmWorkspaceYaml = (workspaceRoot: string): boolean => {
    const yamlPath = join(workspaceRoot, PNPM_WORKSPACE_FILE);

    try {
        const document = parseDocument(readFileSync(yamlPath, "utf8"));

        // setIn creates the intermediate `overrides:` map when absent.
        document.setIn(["overrides", VITE_CLIENT], ALIAS);
        writeFileSync(yamlPath, document.toString());

        return true;
    } catch {
        return false;
    }
};

/** True when the vite client appears in any dependency field of `manifest`. */
const isDependency = (manifest: DependencyManifest | undefined): boolean =>
    manifest !== undefined && DEP_FIELDS.some((field) => manifest[field]?.[VITE_CLIENT] !== undefined);

/**
 * True when an override entry for the vite client already exists — in the
 * root `package.json` (any of `pnpm.overrides` / `overrides` /
 * `resolutions`) or in `pnpm-workspace.yaml`'s `overrides`. We never
 * clobber an existing alias, even one pointing somewhere other than ours.
 */
const isAlreadyOverridden = (pkg: PackageJson | undefined, workspaceOverrides: Record<string, unknown> | undefined): boolean =>
    (pkg !== undefined
        && (pkg.pnpm?.overrides?.[VITE_CLIENT] !== undefined || pkg.overrides?.[VITE_CLIENT] !== undefined || pkg.resolutions?.[VITE_CLIENT] !== undefined))
    || workspaceOverrides?.[VITE_CLIENT] !== undefined;

export interface ViteClientOverrideState {
    /** An override entry for the vite client already exists — leave it alone. */
    alreadyOverridden: boolean;
    /** The user previously declined; don't ask again. */
    declined: boolean;
    /** The package manager driving this workspace (undefined ⇒ no lockfile). */
    manager: LockfilePackageManager | undefined;
    /** The vite client is a dependency (root or any project) or installed at the root. */
    present: boolean;
}

/**
 * Inspects the workspace for the opportunity to alias
 * `@voidzero-dev/vite-task-client` to {@link OUR_CLIENT}. Pure read —
 * never prompts or writes. The caller decides whether to ask.
 *
 * `projectManifests` are the per-project package.json contents already
 * discovered by the run command; passing them lets detection see a tool
 * declared deep in a sub-package, not just the workspace root.
 */
export const detectViteClientOverride = (workspaceRoot: string, projectManifests: DependencyManifest[] = []): ViteClientOverrideState => {
    const pkg = readPackageJson(join(workspaceRoot, "package.json"));
    const installed = existsSync(join(workspaceRoot, "node_modules", "@voidzero-dev", "vite-task-client"));

    return {
        alreadyOverridden: isAlreadyOverridden(pkg, readPnpmWorkspaceOverrides(workspaceRoot)),
        declined: existsSync(join(workspaceRoot, DECLINE_MARKER)),
        manager: detectPackageManager(workspaceRoot)?.manager,
        present: isDependency(pkg) || installed || projectManifests.some((m) => isDependency(m)),
    };
};

/** Records the user's "no" so future runs don't re-ask. */
const recordDecline = (workspaceRoot: string): void => {
    try {
        const markerPath = join(workspaceRoot, DECLINE_MARKER);

        mkdirSync(dirname(markerPath), { recursive: true });
        writeFileSync(markerPath, `Declined adding the ${VITE_CLIENT} → ${OUR_CLIENT} override.\nDelete this file to be asked again.\n`);
    } catch {
        // Best-effort: failing to persist the decline only means we ask again next run.
    }
};

/** Result of writing the override: the file touched and the install command to apply it. */
export interface ViteClientOverrideWrite {
    /** Workspace-relative path of the file that was modified. */
    file: string;
    /** Install command the user should run to apply the override. */
    installCommand: string;
}

/**
 * Writes the `@voidzero-dev/vite-task-client` → {@link OUR_CLIENT} alias
 * into the right place for the detected package manager:
 *
 * - **pnpm / aube** → `pnpm-workspace.yaml`'s `overrides` when that file
 *   exists (the modern pnpm home for overrides), else `package.json`'s
 *   `pnpm.overrides`.
 * - **npm / bun** → `package.json` `overrides`.
 * - **yarn** → `package.json` `resolutions`.
 *
 * Returns the file touched + install command, or `undefined` when
 * nothing could be written.
 */
export const applyViteClientOverride = (workspaceRoot: string, manager: LockfilePackageManager = "npm"): ViteClientOverrideWrite | undefined => {
    const installCommand = `${manager} install`;

    // Prefer pnpm-workspace.yaml for pnpm/aube when it's present (the
    // modern pnpm home for overrides), else fall through to package.json.
    if ((manager === "pnpm" || manager === "aube") && existsSync(join(workspaceRoot, PNPM_WORKSPACE_FILE)) && writeToPnpmWorkspaceYaml(workspaceRoot)) {
        return { file: PNPM_WORKSPACE_FILE, installCommand };
    }

    const packagePath = join(workspaceRoot, "package.json");
    const pkg = readPackageJson(packagePath);

    if (!pkg) {
        return undefined;
    }

    const field = overrideFieldFor(manager);

    if (field === "pnpm.overrides") {
        pkg.pnpm ??= {};
        pkg.pnpm.overrides ??= {};
        pkg.pnpm.overrides[VITE_CLIENT] = ALIAS;
    } else {
        pkg[field] ??= {};
        pkg[field][VITE_CLIENT] = ALIAS;
    }

    try {
        // Trailing newline matches sort-package-json / most formatters.
        writeFileSync(packagePath, `${JSON.stringify(pkg, undefined, 4)}\n`);
    } catch {
        return undefined;
    }

    return { file: "package.json", installCommand };
};

export interface ViteClientOverrideLogger {
    info: (message: string) => void;
    warn: (message: string) => void;
}

/**
 * Interactively offers to add the override when the workspace depends on
 * `@voidzero-dev/vite-task-client` and hasn't already aliased it. No-op
 * when not in an interactive TTY, when the user declined before, or when
 * there's nothing to do — so it never blocks CI or nags.
 * @returns `true` when the override was written (caller may surface the
 * install hint), `false` otherwise.
 */
export const maybePromptViteClientOverride = async (
    workspaceRoot: string,
    options: { interactive: boolean; logger: ViteClientOverrideLogger; projectManifests?: DependencyManifest[] },
): Promise<boolean> => {
    const state = detectViteClientOverride(workspaceRoot, options.projectManifests);

    if (!state.present || state.alreadyOverridden || state.declined || !options.interactive) {
        return false;
    }

    const rl = createInterface({ input: process.stdin, output: process.stdout });

    try {
        options.logger.info(
            `Detected ${VITE_CLIENT}. Its cache hints no-op under @visulima/task-runner unless aliased to ${OUR_CLIENT} (a drop-in replacement).`,
        );

        const answer = await new Promise<string>((resolve) => {
            rl.question("Add the override now? [y/N] ", resolve);
        });

        if (!/^y(?:es)?$/i.test(answer.trim())) {
            recordDecline(workspaceRoot);
            options.logger.info("Skipped. Delete .vis/.vite-client-override-declined to be asked again.");

            return false;
        }

        const written = applyViteClientOverride(workspaceRoot, state.manager);

        if (written === undefined) {
            options.logger.warn("Could not write the override automatically — add it manually (see @visulima/task-runner-client README).");

            return false;
        }

        options.logger.info(`Added "${VITE_CLIENT}": "${ALIAS}" to ${written.file}. Run \`${written.installCommand}\` to apply it.`);

        return true;
    } finally {
        rl.close();
    }
};
