import { readFileSync, writeFileSync } from "node:fs";

import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { DepInstance, DepType } from "../util/workspace-deps";

/**
 * A dep we'd like to promote into a workspace catalog. Emitted when:
 *
 * - No catalog pins the dep yet.
 * - At least `min` workspace packages declare the dep at the same specifier.
 * - No package uses a `catalog:` / `workspace:` reference for that dep
 *   (those signal someone is mid-migration — leave it to them).
 *
 * The proposal targets the default catalog only — named catalogs need a
 * concrete intent (e.g. `dev`, `peer`) that we can't infer here.
 */
export interface CatalogProposal {
    catalogName: string;
    depName: string;
    /** How many workspace packages already declare the dep at `specifier`. */
    instanceCount: number;
    specifier: string;
}

export interface ProposeCatalogOptions {
    /** Existing catalogs (from `readCatalogs`). Deps already pinned anywhere are skipped. */
    catalogs?: Map<string, Map<string, string>>;
    dep?: string;
    ignoreDeps?: string[];
    /** Minimum sibling count to qualify (default: 3). */
    min?: number;
}

const VERSION_DEP_TYPES = new Set<DepType>(["dependencies", "devDependencies", "peerDependencies"]);

const isCatalogReference = (specifier: string): boolean => specifier.startsWith("catalog:");

const isWorkspaceReference = (specifier: string): boolean => specifier.startsWith("workspace:");

const isPinnedInAnyCatalog = (catalogs: Map<string, Map<string, string>> | undefined, depName: string): boolean => {
    if (!catalogs) {
        return false;
    }

    for (const entries of catalogs.values()) {
        if (entries.has(depName)) {
            return true;
        }
    }

    return false;
};

/**
 * Find deps that ≥`min` workspace packages already agree on but that no
 * catalog pins yet. The intent is to promote consensus into a catalog so
 * future bumps happen in one place.
 *
 * Tie-break for the chosen specifier is alphabetical so the result is
 * reproducible across machines.
 */
export const proposeCatalogAdditions = (instances: DepInstance[], options: ProposeCatalogOptions = {}): CatalogProposal[] => {
    const min = options.min ?? 3;
    const ignored = new Set(options.ignoreDeps);

    const eligible = instances.filter((instance) => {
        if (instance.isInternal) {
            return false;
        }

        if (!VERSION_DEP_TYPES.has(instance.depType)) {
            return false;
        }

        if (isWorkspaceReference(instance.specifier)) {
            return false;
        }

        if (options.dep !== undefined && instance.depName !== options.dep) {
            return false;
        }

        return !ignored.has(instance.depName);
    });

    const grouped = new Map<string, DepInstance[]>();

    for (const instance of eligible) {
        const list = grouped.get(instance.depName);

        if (list) {
            list.push(instance);
        } else {
            grouped.set(instance.depName, [instance]);
        }
    }

    const proposals: CatalogProposal[] = [];

    for (const [depName, group] of grouped) {
        if (isPinnedInAnyCatalog(options.catalogs, depName)) {
            continue;
        }

        // At least one package references the catalog for this dep but it
        // isn't actually pinned there. The user is in the middle of setting
        // things up; don't second-guess.
        if (group.some((instance) => isCatalogReference(instance.specifier))) {
            continue;
        }

        // Count distinct *packages*, not instances — a dep that appears in
        // both `dependencies` and `peerDependencies` of the same package
        // should still count as one toward the consensus threshold.
        const counts = new Map<string, Set<string>>();

        for (const instance of group) {
            let bucket = counts.get(instance.specifier);

            if (!bucket) {
                bucket = new Set();
                counts.set(instance.specifier, bucket);
            }

            bucket.add(instance.packageJsonPath);
        }

        const sorted = [...counts.entries()].sort((a, b) => {
            if (a[1].size !== b[1].size) {
                return b[1].size - a[1].size;
            }

            return a[0].localeCompare(b[0]);
        });

        const top = sorted[0];

        if (!top || top[1].size < min) {
            continue;
        }

        proposals.push({ catalogName: "default", depName, instanceCount: top[1].size, specifier: top[0] });
    }

    return proposals.sort((a, b) => a.depName.localeCompare(b.depName));
};

/**
 * Write proposed catalog entries into `pnpm-workspace.yaml`. If a `catalog:`
 * block exists, the new entries are appended to it; otherwise a fresh block
 * is inserted at the top of the file. Existing entries are never overwritten.
 *
 * Bun catalogs (workspaces[].catalog in package.json) aren't supported here.
 */
export const applyCatalogProposals = (workspaceRoot: string, proposals: CatalogProposal[]): string | undefined => {
    if (proposals.length === 0) {
        return undefined;
    }

    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");
    const exists = isAccessibleSync(filePath);
    const original = exists ? readFileSync(filePath, "utf8") : "";
    const newline = original.includes("\r\n") ? "\r\n" : "\n";

    const defaultEntries = proposals.filter((p) => p.catalogName === "default").sort((a, b) => a.depName.localeCompare(b.depName));

    if (defaultEntries.length === 0) {
        return undefined;
    }

    const lines = original.length > 0 ? original.split(newline) : [];

    const catalogBlockStart = lines.findIndex((line) => /^catalog\s*:\s*$/.test(line));

    if (catalogBlockStart === -1) {
        const block = ["catalog:"];

        for (const proposal of defaultEntries) {
            block.push(`  ${proposal.depName}: "${proposal.specifier}"`);
        }

        // Always insert at the top — keeping `catalog:` near the top of
        // pnpm-workspace.yaml matches how humans organize the file. Skip past
        // any leading blank lines so the block doesn't end up before them.
        let insert = 0;

        while (insert < lines.length && (lines[insert] ?? "").trim().length === 0) {
            insert += 1;
        }

        const next = [...lines.slice(0, insert), ...block, "", ...lines.slice(insert)].join(newline);

        writeFileSync(filePath, next.endsWith(newline) ? next : `${next}${newline}`);

        return filePath;
    }

    let blockEnd = lines.length;
    const existingDeps = new Set<string>();

    for (let index = catalogBlockStart + 1; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const trimmed = line.trimStart();

        if (line.length === 0) {
            continue;
        }

        const indent = line.length - trimmed.length;

        if (indent === 0 && trimmed.length > 0 && !trimmed.startsWith("#")) {
            blockEnd = index;
            break;
        }

        const match = /^([\w./@-]+)\s*:/.exec(trimmed);

        if (match?.[1]) {
            existingDeps.add(match[1]);
        }
    }

    const additions: string[] = [];

    for (const proposal of defaultEntries) {
        if (existingDeps.has(proposal.depName)) {
            continue;
        }

        additions.push(`  ${proposal.depName}: "${proposal.specifier}"`);
    }

    if (additions.length === 0) {
        return undefined;
    }

    const next = [...lines.slice(0, blockEnd), ...additions, ...lines.slice(blockEnd)].join(newline);

    writeFileSync(filePath, next.endsWith(newline) ? next : `${next}${newline}`);

    return filePath;
};

/**
 * Render proposals as a unified diff against `pnpm-workspace.yaml`. Used in
 * dry-run output so the user can eyeball exactly what `--fix` would touch.
 */
export const renderCatalogProposalsDiff = (workspaceRoot: string, proposals: CatalogProposal[]): string => {
    if (proposals.length === 0) {
        return "";
    }

    const filePath = join(workspaceRoot, "pnpm-workspace.yaml");
    const exists = isAccessibleSync(filePath);
    const original = exists ? readFileSync(filePath, "utf8") : "";
    const sorted = [...proposals].sort((a, b) => a.depName.localeCompare(b.depName));

    const out: string[] = ["--- pnpm-workspace.yaml", "+++ pnpm-workspace.yaml"];
    const newline = original.includes("\r\n") ? "\r\n" : "\n";
    const lines = original.length > 0 ? original.split(newline) : [];
    const catalogBlockStart = lines.findIndex((line) => /^catalog\s*:\s*$/.test(line));

    if (catalogBlockStart === -1) {
        out.push("@@ +1 @@", "+catalog:");

        for (const proposal of sorted) {
            out.push(`+  ${proposal.depName}: "${proposal.specifier}"`);
        }
    } else {
        out.push("@@ catalog: @@");

        for (const proposal of sorted) {
            out.push(`+  ${proposal.depName}: "${proposal.specifier}"`);
        }
    }

    return out.join(newline);
};
