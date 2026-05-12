import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";

import { findVisConfigFile } from "./config";

const DEFINE_CONFIG_RE = /(defineConfig\s*\(\s*\{)/;
const EXPORT_DEFAULT_RE = /(export\s+default\s+\{)/;

const renderEntry = (key: string, indent: string): string => `${indent}${JSON.stringify(key)}: true,`;

/**
 * Adds entries to `security.policies.install_scripts.allow` inside an
 * existing `vis.config.ts`.
 *
 * The writer is regex-based (no AST). It walks the nesting chain and
 * injects the deepest missing block:
 *
 * 1. `security.policies.install_scripts.allow` already exists — insert
 *    new entries inside the existing `allow` block.
 * 2. `security.policies.install_scripts` exists but no `allow` —
 *    inject the `allow` block as the first child.
 * 3. `security.policies` exists but no `install_scripts` — inject
 *    `install_scripts: { allow: { ... } }` as a child of `policies`.
 * 4. `security` exists but no `policies` — inject the `policies` chain
 *    as a child of `security`.
 * 5. No `security:` block — inject a fresh
 *    `security: { policies: { install_scripts: { allow: { ... } } } }`
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

    // Scope the `allow:` match to follow an `install_scripts:` opener so a
    // hypothetical `allow:` elsewhere (e.g., in another plugin's options)
    // isn't accidentally clobbered. The writer is still regex-based (not
    // an AST), so deeper nesting inside `install_scripts.allow` is not
    // supported — entries there are flat `name: bool` pairs by contract.
    const installScriptsStart = original.search(/install_scripts\s*:\s*\{/);
    let allowBlockMatch: RegExpMatchArray | null = null;
    let allowBlockOffset = 0;

    if (installScriptsStart !== -1) {
        const slice = original.slice(installScriptsStart);
        const localMatch = slice.match(/(allow\s*:\s*\{)([^}]*)(\})/);

        if (localMatch?.index !== undefined) {
            allowBlockMatch = localMatch;
            allowBlockOffset = installScriptsStart + localMatch.index;
        }
    }

    if (allowBlockMatch) {
        const blockBody = allowBlockMatch[2] ?? "";
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

        const indentMatch = blockBody.match(/\n([ \t]+)\S/);
        const indent = indentMatch?.[1] ?? "                ";
        const insertion = `\n${added.map((e) => renderEntry(e, indent)).join("\n")}`;
        const trimmedBody = blockBody.replace(/\s+$/, "");
        const trailing = blockBody.slice(trimmedBody.length);
        const newBody = `${trimmedBody}${trimmedBody.endsWith(",") || trimmedBody === "" ? "" : ","}${insertion}${trailing.length > 0 ? trailing : "\n"}`;

        const updated = `${original.slice(0, allowBlockOffset)}${allowBlockMatch[1]!}${newBody}${allowBlockMatch[3]!}${original.slice(allowBlockOffset + allowBlockMatch[0].length)}`;

        writeFileSync(configPath, updated);

        return { added, configPath, skipped, status: "updated" };
    }

    const installScriptsRegex = /(install_scripts\s*:\s*\{)/;

    if (installScriptsRegex.test(original)) {
        const block = `\n                allow: {\n${entries.map((e) => renderEntry(e, "                    ")).join("\n")}\n                },`;
        const updated = original.replace(installScriptsRegex, `$1${block}`);

        writeFileSync(configPath, updated);

        return { added: entries, configPath, skipped: [], status: "updated" };
    }

    const policiesRegex = /(policies\s*:\s*\{)/;

    if (policiesRegex.test(original)) {
        const block = `\n            install_scripts: {\n                allow: {\n${entries.map((e) => renderEntry(e, "                    ")).join("\n")}\n                },\n            },`;
        const updated = original.replace(policiesRegex, `$1${block}`);

        writeFileSync(configPath, updated);

        return { added: entries, configPath, skipped: [], status: "updated" };
    }

    const securityBlockRegex = /(security\s*:\s*\{)/;

    if (securityBlockRegex.test(original)) {
        const block = `\n        policies: {\n            install_scripts: {\n                allow: {\n${entries.map((e) => renderEntry(e, "                    ")).join("\n")}\n                },\n            },\n        },`;
        const updated = original.replace(securityBlockRegex, `$1${block}`);

        writeFileSync(configPath, updated);

        return { added: entries, configPath, skipped: [], status: "updated" };
    }

    const anchorMatch = DEFINE_CONFIG_RE.exec(original) ?? EXPORT_DEFAULT_RE.exec(original);

    if (!anchorMatch) {
        return { added: [], configPath, skipped: entries, status: "missing-anchor" };
    }

    const block = `\n    security: {\n        policies: {\n            install_scripts: {\n                allow: {\n${entries.map((e) => renderEntry(e, "                    ")).join("\n")}\n                },\n            },\n        },\n    },`;
    const updated = `${original.slice(0, anchorMatch.index + anchorMatch[0].length)}${block}${original.slice(anchorMatch.index + anchorMatch[0].length)}`;

    writeFileSync(configPath, updated);

    return { added: entries, configPath, skipped: [], status: "updated" };
};

export { writeApprovedBuildsToVisConfig };
