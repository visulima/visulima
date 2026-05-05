import type { MountEntry } from "../types";

export type PackageManager = "bun" | "deno" | "npm" | "pnpm" | "yarn";

/**
 * Suggested mounts based on detected package manager.
 */
export const PM_MOUNTS: Record<PackageManager, MountEntry[]> = {
    bun: [
        {
            source: "${localWorkspaceFolderBasename}-node_modules",
            target: "${containerWorkspaceFolder}/node_modules",
            type: "volume",
        },
        {
            source: "${localWorkspaceFolderBasename}-bun-cache",
            target: "/home/node/.bun/install/cache",
            type: "volume",
        },
    ],
    deno: [
        {
            source: "${localWorkspaceFolderBasename}-deno-cache",
            target: "/home/node/.cache/deno",
            type: "volume",
        },
    ],
    npm: [
        {
            source: "${localWorkspaceFolderBasename}-node_modules",
            target: "${containerWorkspaceFolder}/node_modules",
            type: "volume",
        },
        {
            source: "${localWorkspaceFolderBasename}-npm-cache",
            target: "/home/node/.npm",
            type: "volume",
        },
    ],
    pnpm: [
        {
            source: "${localWorkspaceFolderBasename}-node_modules",
            target: "${containerWorkspaceFolder}/node_modules",
            type: "volume",
        },
        {
            source: "${localWorkspaceFolderBasename}-pnpm-store",
            target: "/home/node/.local/share/pnpm/store",
            type: "volume",
        },
    ],
    yarn: [
        {
            source: "${localWorkspaceFolderBasename}-node_modules",
            target: "${containerWorkspaceFolder}/node_modules",
            type: "volume",
        },
        {
            source: "${localWorkspaceFolderBasename}-yarn-cache",
            target: "/home/node/.yarn/cache",
            type: "volume",
        },
    ],
};

/**
 * Feature-specific mount suggestions.
 * Key is a substring of the feature ID to match.
 */
export const FEATURE_MOUNTS: { featureMatch: string; mounts: MountEntry[] }[] = [
    {
        featureMatch: "docker-in-docker",
        mounts: [], // Docker-in-Docker manages its own storage
    },
    {
        featureMatch: "docker-outside-of-docker",
        mounts: [
            {
                source: "/var/run/docker.sock",
                target: "/var/run/docker.sock",
                type: "bind",
            },
        ],
    },
    {
        featureMatch: "/features/git:",
        mounts: [
            {
                source: "${localWorkspaceFolderBasename}-git-config",
                target: "/home/node/.gitconfig",
                type: "volume",
            },
        ],
    },
];

/**
 * Get suggested mounts based on the package manager and enabled features.
 * Returns only mounts that are not already in the current config.
 */
export const getSuggestedMounts = (
    pm: PackageManager | null,
    enabledFeatures: Record<string, Record<string, unknown> | string>,
    currentMounts: (MountEntry | string)[],
): MountEntry[] => {
    const suggestions: MountEntry[] = [];
    const existingTargets = new Set(currentMounts.map((m) => (typeof m === "string" ? m : m.target)));

    // PM-based mounts
    if (pm) {
        for (const mount of PM_MOUNTS[pm]) {
            if (!existingTargets.has(mount.target)) {
                suggestions.push(mount);
            }
        }
    }

    // Feature-based mounts
    const featureIds = Object.keys(enabledFeatures);

    for (const { featureMatch, mounts } of FEATURE_MOUNTS) {
        const hasFeature = featureIds.some((id) => id.includes(featureMatch));

        if (hasFeature) {
            for (const mount of mounts) {
                if (!existingTargets.has(mount.target)) {
                    suggestions.push(mount);
                }
            }
        }
    }

    return suggestions;
};
