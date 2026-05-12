import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";

import { findVisConfigFile } from "./config";

const DEFINE_CONFIG_RE = /(defineConfig\s*\(\s*\{)/;
const EXPORT_DEFAULT_RE = /(export\s+default\s+\{)/;

const renderEntry = (key: string, indent: string): string => `${indent}${JSON.stringify(key)}: true,`;

/**
 * Adds entries to `security.allowBuilds` inside an existing `vis.config.ts`.
 *
 * The writer is regex-based (no AST). It handles three layouts:
 *
 * 1. `security: { allowBuilds: { ... } }` already exists — insert new
 *    entries inside the existing `allowBuilds` block.
 * 2. `security: { ... }` exists but no `allowBuilds` key — inject the
 *    `allowBuilds` block as the first child of `security`.
 * 3. No `security:` block — inject a fresh `security: { allowBuilds: {} }`
 *    as the first child of `defineConfig({` / `export default {`.
 *
 * Returns the result so the caller can decide how to surface the outcome.
 * `status: "noop"` means the entries were already present.
 */
const writeApprovedBuildsToVisConfig = (
    workspaceRoot: string,
    entries: string[],
): {
    added: string[];
    configPath?: string;
    skipped: string[];
    status: "missing-anchor" | "no-config" | "noop" | "updated";
} => {
    if (entries.length === 0) {
        return { added: [], skipped: [], status: "noop" };
    }

    const configPath = findVisConfigFile(workspaceRoot);

    if (!configPath) {
        return { added: [], skipped: entries, status: "no-config" };
    }

    if (!isAccessibleSync(configPath)) {
        return { added: [], skipped: entries, status: "no-config" };
    }

    const original = readFileSync(configPath);

    const allowBuildsBlockMatch = /(allowBuilds\s*:\s*\{)([^}]*)(\})/.exec(original);

    if (allowBuildsBlockMatch) {
        const blockBody = allowBuildsBlockMatch[2] ?? "";
        const existingKeys = new Set<string>();

        for (const keyMatch of blockBody.matchAll(/["']([^"']+)["']\s*:/g)) {
            existingKeys.add(keyMatch[1]!);
        }

        for (const bareMatch of blockBody.matchAll(/(?:^|,|\{)\s*([a-z_$][\w-]*)\s*:/gi)) {
            existingKeys.add(bareMatch[1]!);
        }

        const added: string[] = [];
        const skipped: string[] = [];

        for (const entry of entries) {
            if (existingKeys.has(entry)) {
                skipped.push(entry);
            } else {
                added.push(entry);
            }
        }

        if (added.length === 0) {
            return { added: [], configPath, skipped, status: "noop" };
        }

        const indentMatch = /\n([ \t]+)\S/.exec(blockBody);
        const indent = indentMatch?.[1] ?? "            ";
        const insertion = `\n${added.map((e) => renderEntry(e, indent)).join("\n")}`;
        const trimmedBody = blockBody.replace(/\s+$/, "");
        const trailing = blockBody.slice(trimmedBody.length);
        const newBody = `${trimmedBody}${trimmedBody.endsWith(",") || trimmedBody === "" ? "" : ","}${insertion}${trailing.length > 0 ? trailing : "\n"}`;

        const updated = `${original.slice(0, allowBuildsBlockMatch.index)}${allowBuildsBlockMatch[1]!}${newBody}${allowBuildsBlockMatch[3]!}${original.slice(allowBuildsBlockMatch.index + allowBuildsBlockMatch[0].length)}`;

        writeFileSync(configPath, updated);

        return { added, configPath, skipped, status: "updated" };
    }

    const securityBlockRegex = /(security\s*:\s*\{)/;

    if (securityBlockRegex.test(original)) {
        const block = `\n        allowBuilds: {\n${entries.map((e) => renderEntry(e, "            ")).join("\n")}\n        },`;
        const updated = original.replace(securityBlockRegex, `$1${block}`);

        writeFileSync(configPath, updated);

        return { added: entries, configPath, skipped: [], status: "updated" };
    }

    const anchorMatch = DEFINE_CONFIG_RE.exec(original) ?? EXPORT_DEFAULT_RE.exec(original);

    if (!anchorMatch) {
        return { added: [], configPath, skipped: entries, status: "missing-anchor" };
    }

    const block = `\n    security: {\n        allowBuilds: {\n${entries.map((e) => renderEntry(e, "            ")).join("\n")}\n        },\n    },`;
    const updated = `${original.slice(0, anchorMatch.index + anchorMatch[0].length)}${block}${original.slice(anchorMatch.index + anchorMatch[0].length)}`;

    writeFileSync(configPath, updated);

    return { added: entries, configPath, skipped: [], status: "updated" };
};

export { writeApprovedBuildsToVisConfig };
