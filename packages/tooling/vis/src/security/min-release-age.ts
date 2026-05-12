import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { formatMinutesAsTimeString, renderYamlKey } from "./duration";
import type { PackageManagerName } from "./types";

/**
 * Mirrors `security.minimumReleaseAge` (and the excludes list) from vis-config
 * to the package manager's native config so the PM's own install/update path
 * enforces the same gate vis already enforces internally.
 *
 * Per-PM target + unit:
 *
 * - **pnpm** → `pnpm-workspace.yaml`: `minimumReleaseAge` (minutes) +
 *   `minimumReleaseAgeExclude` (list).
 * - **bun** → `bunfig.toml [install]`: `minimumReleaseAge` (**seconds**) +
 *   `minimumReleaseAgeExcludes` (list, plural per bun's docs).
 * - **npm** → `.npmrc`: `min-release-age=&lt;duration>` (e.g. `2d`, `48h`).
 *   npm has no native per-package exclude list.
 * - **yarn** (berry) → `.yarnrc.yml`: `npmMinimalAgeGate: "&lt;duration>"`.
 *   yarn classic has no equivalent — we skip with a note.
 *
 * The vis-internal unit is **minutes**; this helper converts to whatever
 * each PM expects. `minutes` is `undefined` → no-op (returns a single
 * "not set in vis.config" action). `0` writes a literal zero, which the
 * package manager interprets as "no gating" — explicit-disable, not delete.
 */
const syncMinimumReleaseAgeToNativeConfig = (
    pm: PackageManagerName,
    workspaceRoot: string,
    minutes: number | undefined,
    excludes: string[] = [],
): string[] => {
    const actions: string[] = [];

    if (minutes === undefined) {
        actions.push("minimumReleaseAge not set in vis.config; skipping native sync.");

        return actions;
    }

    const wholeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;

    switch (pm) {
        case "bun": {
            const tomlPath = join(workspaceRoot, "bunfig.toml");
            let content = isAccessibleSync(tomlPath) ? readFileSync(tomlPath) : "";
            const seconds = wholeMinutes * 60;
            const ageLine = `minimumReleaseAge = ${String(seconds)}`;
            const excludesLine = excludes.length > 0
                ? `minimumReleaseAgeExcludes = [${excludes.map((p) => `"${p.replaceAll(String.raw`"`, String.raw`\"`)}"`).join(", ")}]`
                : undefined;
            const installHeader = /^\[install\][ \t]*\n/m.exec(content);

            if (installHeader?.index === undefined) {
                const sectionBody = excludesLine ? `${ageLine}\n${excludesLine}` : ageLine;

                content = `${content.trimEnd() ? `${content.trimEnd()}\n\n` : ""}[install]\n${sectionBody}\n`;
            } else {
                const sectionStart = installHeader.index + installHeader[0].length;
                const afterHeader = content.slice(sectionStart);
                const nextSection = /^\[/m.exec(afterHeader);
                const sectionEnd = nextSection?.index === undefined ? content.length : sectionStart + nextSection.index;
                let body = content.slice(sectionStart, sectionEnd);

                body = /^[ \t]*minimumReleaseAge[ \t]*=/m.test(body)
                    ? body.replace(/^[ \t]*minimumReleaseAge[ \t]*=.*$/m, ageLine)
                    : `${ageLine}\n${body}`;

                if (excludesLine) {
                    body = /^[ \t]*minimumReleaseAgeExcludes[ \t]*=/m.test(body)
                        ? body.replace(/^[ \t]*minimumReleaseAgeExcludes[ \t]*=.*$/m, excludesLine)
                        : `${excludesLine}\n${body}`;
                }

                content = `${content.slice(0, sectionStart)}${body}${content.slice(sectionEnd)}`;
            }

            writeFileSync(tomlPath, content.endsWith("\n") ? content : `${content}\n`);
            actions.push(`Updated bunfig.toml [install] minimumReleaseAge = ${String(seconds)} (${String(wholeMinutes)} minutes)`);

            if (excludesLine) {
                actions.push(`Updated bunfig.toml [install] minimumReleaseAgeExcludes (${String(excludes.length)} entries)`);
            }

            break;
        }

        case "npm": {
            const npmrcPath = join(workspaceRoot, ".npmrc");
            let content = isAccessibleSync(npmrcPath) ? readFileSync(npmrcPath) : "";
            const duration = formatMinutesAsTimeString(wholeMinutes);
            const line = `min-release-age=${duration}`;

            content = /^\s*min-release-age\s*=/m.test(content)
                ? content.replace(/^\s*min-release-age\s*=.*$/m, line)
                : `${content.trimEnd()}\n${line}\n`;

            writeFileSync(npmrcPath, content.endsWith("\n") ? content : `${content}\n`);
            actions.push(`Updated .npmrc min-release-age=${duration} (${String(wholeMinutes)} minutes)`);

            if (excludes.length > 0) {
                actions.push("npm has no native per-package exclude list; skipped excludes sync.");
            }

            break;
        }

        case "pnpm": {
            const yamlPath = join(workspaceRoot, "pnpm-workspace.yaml");

            if (!isAccessibleSync(yamlPath)) {
                actions.push("pnpm-workspace.yaml not found. Cannot sync minimumReleaseAge.");

                break;
            }

            let content = readFileSync(yamlPath);

            if (!content.endsWith("\n")) {
                content += "\n";
            }

            const ageLine = `minimumReleaseAge: ${String(wholeMinutes)}\n`;

            content = /^minimumReleaseAge[ \t]*:.*$/m.test(content)
                ? content.replace(/^minimumReleaseAge[ \t]*:.*$/m, ageLine.trimEnd())
                : `${content.trimEnd()}\n\n${ageLine}`;

            if (excludes.length > 0) {
                const block = `minimumReleaseAgeExclude:\n${excludes.map((p) => `  - ${renderYamlKey(p)}`).join("\n")}\n`;
                const blockRegex = /^minimumReleaseAgeExclude:[ \t]*\n(?:[ \t]{2}[^\n]*\n)*/m;

                content = blockRegex.test(content) ? content.replace(blockRegex, block) : `${content.trimEnd()}\n\n${block}`;
            }

            writeFileSync(yamlPath, content);
            actions.push(`Updated pnpm-workspace.yaml minimumReleaseAge: ${String(wholeMinutes)} minutes`);

            if (excludes.length > 0) {
                actions.push(`Updated pnpm-workspace.yaml minimumReleaseAgeExclude (${String(excludes.length)} entries)`);
            }

            break;
        }

        case "yarn": {
            const yarnrcPath = join(workspaceRoot, ".yarnrc.yml");

            if (!isAccessibleSync(yarnrcPath)) {
                actions.push("yarn classic lacks npmMinimalAgeGate; .yarnrc.yml not found, skipping.");

                break;
            }

            let content = readFileSync(yarnrcPath);
            const duration = formatMinutesAsTimeString(wholeMinutes);
            const line = `npmMinimalAgeGate: "${duration}"`;

            if (!content.endsWith("\n")) {
                content += "\n";
            }

            content = /^npmMinimalAgeGate[ \t]*:.*$/m.test(content)
                ? content.replace(/^npmMinimalAgeGate[ \t]*:.*$/m, line)
                : `${content.trimEnd()}\n\n${line}\n`;

            writeFileSync(yarnrcPath, content);
            actions.push(`Updated .yarnrc.yml npmMinimalAgeGate: "${duration}" (${String(wholeMinutes)} minutes)`);

            if (excludes.length > 0) {
                actions.push("yarn has no native per-package exclude list; skipped excludes sync.");
            }

            break;
        }

        default: {
            break;
        }
    }

    return actions;
};

export { syncMinimumReleaseAgeToNativeConfig };
