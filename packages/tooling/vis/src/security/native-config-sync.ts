import { isAccessibleSync, readFileSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { readYamlSync } from "@visulima/fs/yaml";
import { join } from "@visulima/path";

import { isYarnBerry } from "./pm-helpers";
import type { PackageManagerName } from "./types";

/**
 * Syncs vis security.policies.install_scripts.allow to native PM config format.
 */
const syncAllowBuildsToNativeConfig = (pm: PackageManagerName, workspaceRoot: string, allowBuilds: Record<string, boolean>): string[] => {
    const actions: string[] = [];
    const approved = Object.entries(allowBuilds)
        .filter(([, v]) => v)
        .map(([k]) => k);

    switch (pm) {
        case "bun": {
            const pkgPath = join(workspaceRoot, "package.json");

            if (isAccessibleSync(pkgPath)) {
                try {
                    const pkg = readJsonSync(pkgPath) as { trustedDependencies?: string[] };

                    pkg.trustedDependencies = approved;
                    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
                    actions.push(`Updated package.json trustedDependencies with ${approved.length} packages`);
                } catch (error: unknown) {
                    actions.push(`Failed to update package.json: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            break;
        }

        case "npm": {
            const npmrcPath = join(workspaceRoot, ".npmrc");
            let content = isAccessibleSync(npmrcPath) ? readFileSync(npmrcPath) : "";

            if (/^\s*ignore-scripts\s*=\s*true\s*$/m.test(content)) {
                actions.push(".npmrc already has ignore-scripts=true");
            } else {
                content = `${content.trimEnd()}\nignore-scripts=true\n`;
                writeFileSync(npmrcPath, content);
                actions.push("Added ignore-scripts=true to .npmrc");
            }

            break;
        }

        case "pnpm": {
            const filePath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (!isAccessibleSync(filePath)) {
                actions.push("pnpm-workspace.yaml not found. Cannot sync allowBuilds.");
                break;
            }

            let existing: Record<string, boolean> = {};
            let existingList: string[] = [];

            try {
                const data = readYamlSync(filePath) as
                    | {
                        allowBuilds?: Record<string, boolean>;
                        onlyBuiltDependencies?: string[];
                    }
                    | undefined;

                existing = data?.allowBuilds ?? {};
                existingList = Array.isArray(data?.onlyBuiltDependencies) ? data.onlyBuiltDependencies : [];
            } catch {
                /* fall through: treat as empty */
            }

            const merged: Record<string, boolean> = { ...existing, ...allowBuilds };
            const addedCount = Object.keys(allowBuilds).filter((key) => existing[key] !== allowBuilds[key]).length;

            const approvedSorted = approved.toSorted((a, b) => a.localeCompare(b));
            const onlyBuiltMerged = [...new Set([...existingList, ...approvedSorted])].toSorted((a, b) => a.localeCompare(b));
            const onlyBuiltAddedCount = approvedSorted.filter((name) => !existingList.includes(name)).length;

            if (addedCount === 0 && onlyBuiltAddedCount === 0) {
                actions.push(`All ${String(Object.keys(allowBuilds).length)} allowBuilds entries already present in pnpm-workspace.yaml.`);
            } else {
                const sortedKeys = Object.keys(merged).sort();
                const needsQuote = (key: string): boolean => key.startsWith("@") || key.includes("/") || /[:#\s]/.test(key);
                const renderKey = (key: string): string => (needsQuote(key) ? `'${key.replaceAll("'", "''")}'` : key);
                const block = sortedKeys.map((key) => `  ${renderKey(key)}: ${String(merged[key])}`).join("\n");
                const allowBuildsBlock = `allowBuilds:\n${block}\n`;

                let content = readFileSync(filePath);

                if (!content.endsWith("\n")) {
                    content += "\n";
                }

                const existingBlockRegex = /^allowBuilds:[ \t]*\n(?:[ \t]{2}[^\n]*\n)*/m;

                content = existingBlockRegex.test(content)
                    ? content.replace(existingBlockRegex, allowBuildsBlock)
                    : `${content.trimEnd()}\n\n${allowBuildsBlock}`;

                if (onlyBuiltMerged.length > 0) {
                    const listBlock = `onlyBuiltDependencies:\n${onlyBuiltMerged.map((name) => `  - ${needsQuote(name) ? `'${name.replaceAll("'", "''")}'` : name}`).join("\n")}\n`;
                    const existingListRegex = /^onlyBuiltDependencies:[ \t]*\n(?:[ \t]{2}[^\n]*\n)*/m;

                    content = existingListRegex.test(content) ? content.replace(existingListRegex, listBlock) : `${content.trimEnd()}\n\n${listBlock}`;
                }

                writeFileSync(filePath, content);
                actions.push(`Updated pnpm-workspace.yaml allowBuilds (${String(addedCount)} new, ${String(sortedKeys.length)} total)`);

                if (onlyBuiltAddedCount > 0) {
                    actions.push(
                        `Updated pnpm-workspace.yaml onlyBuiltDependencies (${String(onlyBuiltAddedCount)} new, ${String(onlyBuiltMerged.length)} total)`,
                    );
                }
            }

            const pkgPath = join(workspaceRoot, "package.json");

            if (isAccessibleSync(pkgPath) && approvedSorted.length > 0) {
                try {
                    const pkg = readJsonSync(pkgPath) as { pnpm?: { onlyBuiltDependencies?: string[] } };
                    const pkgExisting = Array.isArray(pkg.pnpm?.onlyBuiltDependencies) ? pkg.pnpm.onlyBuiltDependencies : [];
                    const pkgMerged = [...new Set([...pkgExisting, ...approvedSorted])].toSorted((a, b) => a.localeCompare(b));
                    const pkgAddedCount = approvedSorted.filter((name) => !pkgExisting.includes(name)).length;

                    if (pkgAddedCount > 0) {
                        pkg.pnpm = { ...pkg.pnpm, onlyBuiltDependencies: pkgMerged };
                        writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
                        actions.push(`Updated package.json pnpm.onlyBuiltDependencies (${String(pkgAddedCount)} new, ${String(pkgMerged.length)} total)`);
                    }
                } catch (error: unknown) {
                    actions.push(`Failed to update package.json pnpm.onlyBuiltDependencies: ${error instanceof Error ? error.message : String(error)}`);
                }
            }

            break;
        }

        case "yarn": {
            if (isYarnBerry(workspaceRoot)) {
                const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");
                let content = readFileSync(yarnrcPath);
                const hasKey = /^\s*enableScripts\s*:/m.test(content);
                const hasFalse = /^\s*enableScripts\s*:\s*false\s*$/m.test(content);

                if (!hasKey) {
                    content = `${content.trimEnd()}\nenableScripts: false\n`;
                    writeFileSync(yarnrcPath, content);
                    actions.push("Added enableScripts: false to .yarnrc.yml");
                } else if (hasFalse) {
                    actions.push(".yarnrc.yml already has enableScripts: false");
                } else {
                    content = content.replace(/^\s*enableScripts\s*:.+$/m, "enableScripts: false");
                    writeFileSync(yarnrcPath, content);
                    actions.push("Changed enableScripts to false in .yarnrc.yml");
                }
            } else {
                const npmrcPath = join(workspaceRoot, ".npmrc");
                let content = isAccessibleSync(npmrcPath) ? readFileSync(npmrcPath) : "";

                if (/^\s*ignore-scripts\s*=\s*true\s*$/m.test(content)) {
                    actions.push(".npmrc already has ignore-scripts=true");
                } else {
                    content = `${content.trimEnd()}\nignore-scripts=true\n`;
                    writeFileSync(npmrcPath, content);
                    actions.push("Added ignore-scripts=true to .npmrc (yarn classic lacks enableScripts)");
                }
            }

            break;
        }
        default: {
            break;
        }
    }

    return actions;
};

export { syncAllowBuildsToNativeConfig };
