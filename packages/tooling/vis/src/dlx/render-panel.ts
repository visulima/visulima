/**
 * Render the dlx first-run info panel and prompt for confirmation.
 *
 * The panel is a bordered box (size / score / permissions) followed by a
 * changelog section. Width is computed with `getStringWidth` so embedded ANSI
 * colours and wide characters don't break alignment.
 */

import { stripVTControlCharacters } from "node:util";

import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";
import { formatBytes } from "@visulima/humanizer";
import { getStringWidth } from "@visulima/string";

import type { PackageAlert } from "../security/socket-security";
import type { PackageInfo } from "./package-info";

/** Visible column width, ignoring ANSI colour escapes. */
const visibleWidth = (text: string): number => getStringWidth(stripVTControlCharacters(text));

const SEVERITY_TINT: Record<PackageAlert["severity"], (text: string) => string> = {
    critical: red,
    high: red,
    low: dim,
    medium: yellow,
};

/** Humanise a byte count for the panel, or `undefined` when the size is unknown. */
const formatSize = (bytes: number | undefined): string | undefined => {
    if (bytes === undefined || bytes < 0) {
        return undefined;
    }

    return formatBytes(bytes, { decimals: 1, space: true });
};

const formatSizeRow = (info: PackageInfo): string | undefined => {
    const { fileCount, tarballBytes, unpackedBytes } = info.size;
    const unpacked = formatSize(unpackedBytes);
    const tarball = formatSize(tarballBytes);

    if (unpacked && tarball) {
        const files = fileCount ? `, ${String(fileCount)} files` : "";

        return `${unpacked} unpacked (${tarball} tarball${files})`;
    }

    if (unpacked) {
        return `${unpacked} unpacked`;
    }

    if (tarball) {
        return `${tarball} tarball`;
    }

    return undefined;
};

const formatScoreRow = (info: PackageInfo): string => {
    const { alerts, available, score } = info.security;

    if (!available) {
        return dim("unavailable — set VIS_SOCKET_TOKEN for a Socket.dev score");
    }

    const tint = score === undefined ? dim : score >= 70 ? green : score >= 40 ? yellow : red;
    const scoreText = score === undefined ? "n/a" : `${String(score)}/100`;

    const counts = new Map<PackageAlert["severity"], number>();

    for (const alert of alerts) {
        counts.set(alert.severity, (counts.get(alert.severity) ?? 0) + 1);
    }

    const alertParts: string[] = [];
    const severities: PackageAlert["severity"][] = ["critical", "high", "medium", "low"];

    for (const severity of severities) {
        const count = counts.get(severity);

        if (count) {
            alertParts.push(SEVERITY_TINT[severity](`${String(count)} ${severity}`));
        }
    }

    const alertSummary = alertParts.length > 0 ? `  ${yellow("!")} ${alertParts.join(", ")}` : `  ${green("no alerts")}`;

    return `${tint(scoreText)} ${dim("(Socket.dev)")}${alertSummary}`;
};

const formatPermissionsRow = (info: PackageInfo): string | undefined => {
    const { bins, capabilities, lifecycleScripts } = info.permissions;
    const parts: string[] = [];

    for (const hook of lifecycleScripts) {
        parts.push(yellow(`${hook} script`));
    }

    for (const capability of capabilities) {
        parts.push(yellow(capability));
    }

    if (bins.length > 0) {
        parts.push(dim(`bins: ${bins.join(", ")}`));
    }

    return parts.length > 0 ? parts.join(dim(" · ")) : undefined;
};

interface PanelRow {
    label: string;
    /** One or more value lines; only the first carries the label. */
    values: string[];
}

const buildRows = (info: PackageInfo): PanelRow[] => {
    const rows: PanelRow[] = [];

    const sizeRow = formatSizeRow(info);

    if (sizeRow) {
        rows.push({ label: "size", values: [sizeRow] });
    }

    rows.push({ label: "score", values: [formatScoreRow(info)] });

    const permissionsRow = formatPermissionsRow(info);

    if (permissionsRow) {
        rows.push({ label: "perms", values: [permissionsRow] });
    }

    if (info.changelog) {
        const sourceLabel = info.changelog.source === "npm-diff" ? "registry" : info.changelog.source === "repo-file" ? "repo CHANGELOG" : "CHANGELOG";

        rows.push({ label: "latest", values: [...info.changelog.lines, dim(`source: ${sourceLabel}`)] });
    }

    return rows;
};

const LABEL_WIDTH = 6;

/** Build the bordered panel as an array of lines (no trailing newline). */
export const renderFirstRunPanel = (info: PackageInfo): string[] => {
    const rows = buildRows(info);
    const title = ` first run: ${info.name}@${info.version} `;

    // Flatten rows into rendered content lines (label column + value).
    const content: string[] = [];

    for (const row of rows) {
        row.values.forEach((value, index) => {
            const label = index === 0 ? cyan(row.label.padEnd(LABEL_WIDTH)) : " ".repeat(LABEL_WIDTH);

            content.push(`${label} ${value}`);
        });
    }

    const innerWidth = Math.max(visibleWidth(title), ...content.map((line) => visibleWidth(line)));
    const pad = (line: string): string => `${line}${" ".repeat(Math.max(0, innerWidth - visibleWidth(line)))}`;

    const top = `┌─${bold(title)}${"─".repeat(Math.max(0, innerWidth - visibleWidth(title)))}─┐`;
    const bottom = `└─${"─".repeat(innerWidth)}─┘`;

    return [top, ...content.map((line) => `│ ${pad(line)} │`), bottom];
};
