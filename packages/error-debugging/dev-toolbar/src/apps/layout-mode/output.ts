// =============================================================================
// Layout Mode Output Generator
// =============================================================================

import type { PageLayout } from "./spatial";
import {
    analyzeLayoutPatterns,
    formatCSSPosition,
    formatPositionSummary,
    formatSpatialLines,
    getElementCSSContext,
    getPageLayout,
    getSpatialContext,
} from "./spatial";
import type { DesignPlacement, RearrangeState } from "./types";
import { COMPONENT_MAP } from "./types";

type ViewportSize = { height: number; width: number };
type OutputDetailLevel = "compact" | "standard" | "detailed" | "forensic";

type DesignOutputOptions = {
    blankCanvas?: boolean;
    wireframePurpose?: string;
};

// =============================================================================
// Shared: Reference Frame
// =============================================================================

/**
 * Generate a reference frame section with viewport, content area, and
 * pixel-to-CSS translation formulas. Included in all non-compact output.
 */
const formatReferenceFrame = (layout: PageLayout): string => {
    const { contentArea, viewport } = layout;
    let out = "### Reference Frame\n";

    out += `- Viewport: \`${viewport.width}×${viewport.height}px\`\n`;

    if (contentArea) {
        const ca = contentArea;

        out += `- Content area: \`${ca.width}px\` wide, left edge at \`x=${ca.left}\`, right at \`x=${ca.right}\` (\`${ca.selector}\`)\n`;
        out += `- Pixel → CSS translation:\n`;
        out += `  - **Horizontal position in container**: \`element.x - ${ca.left}\` → use as \`margin-left\` or \`left\`\n`;
        out += `  - **Width as % of container**: \`element.width / ${ca.width} × 100\` → use as \`width: X%\`\n`;
        out += `  - **Vertical gap between elements**: \`nextElement.y - (prevElement.y + prevElement.height)\` → use as \`margin-top\` or \`gap\`\n`;
        out += `  - **Centered**: if \`|element.centerX - ${ca.centerX}| < 20px\` → use \`margin-inline: auto\`\n`;
    } else {
        out += `- No distinct content container — elements positioned relative to full viewport\n`;
        out += `- Pixel → CSS translation:\n`;
        out += `  - **Width as % of viewport**: \`element.width / ${viewport.width} × 100\` → use as \`width: X%\`\n`;
        out += `  - **Centered**: if \`|(element.x + element.width/2) - ${Math.round(viewport.width / 2)}| < 20px\` → use \`margin-inline: auto\`\n`;
    }

    out += "\n";

    return out;
};

/**
 * Format parent layout context for an element.
 * Returns a line like: "Parent: `flex`, flex-direction: `column`, gap: `24px` (`main > div`)"
 */
const formatParentContext = (selector: string): string | null => {
    const ctx = getElementCSSContext(selector);

    if (!ctx)
        return null;

    let desc = `\`${ctx.parentDisplay}\``;

    if (ctx.flexDirection)
        desc += `, flex-direction: \`${ctx.flexDirection}\``;

    if (ctx.gridCols)
        desc += `, grid-template-columns: \`${ctx.gridCols}\``;

    if (ctx.gap)
        desc += `, gap: \`${ctx.gap}\``;

    return `Parent: ${desc} (\`${ctx.parentSelector}\`)`;
};

// =============================================================================
// Design (Add/Place) Output
// =============================================================================

export const generateDesignOutput = (
    placements: DesignPlacement[],
    viewport: ViewportSize,
    options?: DesignOutputOptions,
    detailLevel: OutputDetailLevel = "standard",
): string => {
    if (placements.length === 0)
        return "";

    // Sort by vertical then horizontal position
    const sorted = placements.toSorted((a, b) => {
        if (Math.abs(a.y - b.y) < 20)
            return a.x - b.x;

        return a.y - b.y;
    });

    let out = "";

    if (options?.blankCanvas) {
        out += `## Wireframe: New Page\n\n`;

        if (options.wireframePurpose) {
            out += `> **Purpose:** ${options.wireframePurpose}\n>\n`;
        }

        out += `> ${placements.length} component${placements.length === 1 ? "" : "s"} placed — this is a standalone wireframe, not related to the current page.\n>\n> This wireframe is a rough sketch for exploring ideas.\n\n`;
    } else {
        out += `## Design Layout\n\n> ${placements.length} component${placements.length === 1 ? "" : "s"} placed\n\n`;
    }

    // Compact: no reference frame
    if (detailLevel === "compact") {
        out += "### Components\n";
        sorted.forEach((c, i) => {
            const label = COMPONENT_MAP[c.type]?.label || c.type;

            out += `${i + 1}. **${label}** — \`${Math.round(c.width)}×${Math.round(c.height)}px\` at \`(${Math.round(c.x)}, ${Math.round(c.y)})\`\n`;
        });

        return out;
    }

    // Reference frame for standard+
    const layout = getPageLayout(viewport);

    out += formatReferenceFrame(layout);

    // --- Component list ---
    out += "### Components\n";
    sorted.forEach((c, i) => {
        const label = COMPONENT_MAP[c.type]?.label || c.type;
        const rect = { height: c.height, width: c.width, x: c.x, y: c.y };

        out += `${i + 1}. **${label}** — \`${Math.round(c.width)}×${Math.round(c.height)}px\` at \`(${Math.round(c.x)}, ${Math.round(c.y)})\`\n`;

        // Spatial context
        const ctx = getSpatialContext(rect);
        const includeLeftRight = detailLevel === "detailed" || detailLevel === "forensic";
        const lines = formatSpatialLines(ctx, { includeLeftRight });

        for (const line of lines) {
            out += `   - ${line}\n`;
        }

        // CSS position relative to content area
        const cssPos = formatCSSPosition(rect, layout);

        if (cssPos) {
            out += `   - CSS: ${cssPos}\n`;
        }
    });

    // --- Layout analysis: group by rows ---
    out += "\n### Layout Analysis\n";
    const rows: { items: DesignPlacement[]; y: number }[] = [];

    for (const c of sorted) {
        const existing = rows.find((r) => Math.abs(r.y - c.y) < 30);

        if (existing) {
            existing.items.push(c);
        } else {
            rows.push({ items: [c], y: c.y });
        }
    }

    rows.sort((a, b) => a.y - b.y);

    rows.forEach((row, i) => {
        row.items.sort((a, b) => a.x - b.x);
        const labels = row.items.map((c) => COMPONENT_MAP[c.type]?.label || c.type);

        if (row.items.length === 1) {
            const c = row.items[0]!;
            const isFullWidth = c.width > viewport.width * 0.8;

            out += `- Row ${i + 1} (y≈${Math.round(row.y)}): ${labels[0]}${isFullWidth ? " — full width" : ""}\n`;
        } else {
            out += `- Row ${i + 1} (y≈${Math.round(row.y)}): ${labels.join(" | ")} — ${row.items.length} items side by side\n`;
        }
    });

    // --- Spacing/gap relationships (detailed+) ---
    if (detailLevel === "detailed" || detailLevel === "forensic") {
        out += "\n### Spacing & Gaps\n";

        for (let i = 0; i < sorted.length - 1; i++) {
            const a = sorted[i]!;
            const b = sorted[i + 1]!;
            const labelA = COMPONENT_MAP[a.type]?.label || a.type;
            const labelB = COMPONENT_MAP[b.type]?.label || b.type;
            const vGap = Math.round(b.y - (a.y + a.height));
            const hGap = Math.round(b.x - (a.x + a.width));

            out += Math.abs(a.y - b.y) < 30 ? `- ${labelA} → ${labelB}: \`${hGap}px\` horizontal gap\n` : `- ${labelA} → ${labelB}: \`${vGap}px\` vertical gap\n`;
        }

        if (detailLevel === "forensic" && sorted.length > 2) {
            out += "\n### All Pairwise Gaps\n";

            for (let i = 0; i < sorted.length; i++) {
                for (let j = i + 1; j < sorted.length; j++) {
                    const a = sorted[i]!;
                    const b = sorted[j]!;
                    const labelA = COMPONENT_MAP[a.type]?.label || a.type;
                    const labelB = COMPONENT_MAP[b.type]?.label || b.type;
                    const vGap = Math.round(b.y - (a.y + a.height));
                    const hGap = Math.round(b.x - (a.x + a.width));

                    out += `- ${labelA} ↔ ${labelB}: h=\`${hGap}px\` v=\`${vGap}px\`\n`;
                }
            }
        }

        if (detailLevel === "forensic") {
            out += "\n### Z-Order (placement order)\n";
            placements.forEach((c, i) => {
                const label = COMPONENT_MAP[c.type]?.label || c.type;

                out += `${i}. ${label} at \`(${Math.round(c.x)}, ${Math.round(c.y)})\`\n`;
            });
        }
    }

    // --- Suggested implementation ---
    out += "\n### Suggested Implementation\n";

    const hasNav = sorted.some((c) => c.type === "navigation");
    const hasHero = sorted.some((c) => c.type === "hero");
    const hasSidebar = sorted.some((c) => c.type === "sidebar");
    const hasFooter = sorted.some((c) => c.type === "footer");
    const cards = sorted.filter((c) => c.type === "card");
    const forms = sorted.filter((c) => c.type === "form");
    const tables = sorted.filter((c) => c.type === "table");
    const modals = sorted.filter((c) => c.type === "modal");

    if (hasNav)
        out += "- Top navigation bar with logo + nav links + CTA\n";

    if (hasHero)
        out += "- Hero section with heading, subtext, and call-to-action\n";

    if (hasSidebar)
        out += "- Sidebar layout — use CSS Grid with sidebar + main content area\n";

    if (cards.length > 1)
        out += `- ${cards.length}-column card grid — use CSS Grid or Flexbox\n`;
    else if (cards.length === 1)
        out += "- Card component with image + content area\n";

    if (forms.length > 0)
        out += `- ${forms.length} form${forms.length > 1 ? "s" : ""} — add proper labels, validation, and submit handling\n`;

    if (tables.length > 0)
        out += "- Data table — consider sortable columns and pagination\n";

    if (modals.length > 0)
        out += "- Modal dialog — add overlay backdrop and focus trapping\n";

    if (hasFooter)
        out += "- Multi-column footer with links\n";

    if (detailLevel === "detailed" || detailLevel === "forensic") {
        out += "\n### CSS Suggestions\n";

        if (hasSidebar) {
            const sidebar = sorted.find((c) => c.type === "sidebar")!;

            out += `- \`display: grid; grid-template-columns: ${Math.round(sidebar.width)}px 1fr;\`\n`;
        }

        if (cards.length > 1) {
            const cardW = Math.round(cards[0]!.width);

            out += `- \`display: grid; grid-template-columns: repeat(${cards.length}, ${cardW}px); gap: 16px;\`\n`;
        }

        if (hasNav) {
            out += `- Navigation: \`position: sticky; top: 0; z-index: 50;\`\n`;
        }
    }

    return out;
};

// =============================================================================
// Rearrange Output
// =============================================================================

/**
 * Generate markdown output describing position/size changes vs original.
 * Returns empty string if nothing has been moved or resized.
 */
export const generateRearrangeOutput = (
    state: RearrangeState,
    detailLevel: OutputDetailLevel = "standard",
    viewport?: ViewportSize,
): string => {
    const { sections } = state;

    // Collect sections that actually changed
    type ChangeEntry = {
        posMoved: boolean;
        section: (typeof sections)[number];
        sizeChanged: boolean;
    };
    const changed: ChangeEntry[] = [];

    for (const s of sections) {
        const o = s.originalRect;
        const c = s.currentRect;

        const posMoved = Math.abs(o.x - c.x) > 1 || Math.abs(o.y - c.y) > 1;
        const sizeChanged = Math.abs(o.width - c.width) > 1 || Math.abs(o.height - c.height) > 1;

        if (!posMoved && !sizeChanged) {
            if (detailLevel === "forensic") {
                changed.push({ posMoved: false, section: s, sizeChanged: false });
            }

            continue;
        }

        changed.push({ posMoved, section: s, sizeChanged });
    }

    // Nothing changed
    if (changed.length === 0)
        return "";

    if (detailLevel !== "forensic" && changed.every((e) => !e.posMoved && !e.sizeChanged))
        return "";

    let out = "## Suggested Layout Changes\n\n";

    // --- Reference frame (always for non-compact) ---
    const vw = viewport ? viewport.width : (globalThis.window === undefined ? 0 : window.innerWidth);
    const vh = viewport ? viewport.height : (globalThis.window === undefined ? 0 : window.innerHeight);
    const layout = getPageLayout({ height: vh, width: vw });

    if (detailLevel !== "compact") {
        out += formatReferenceFrame(layout);
    }

    // Forensic extras
    if (detailLevel === "forensic") {
        out += `> Detected at: \`${new Date(state.detectedAt).toISOString()}\`\n`;
        out += `> Total sections: ${sections.length}\n\n`;
    }

    // Build sibling candidates from ALL sections
    const siblingCandidates = (rects: "original" | "current") =>
        sections.map((s) => {
            return {
                label: s.label,
                rect: rects === "original" ? s.originalRect : s.currentRect,
                selector: s.selector,
            };
        });

    out += "**Changes:**\n";

    for (const { posMoved, section: s, sizeChanged } of changed) {
        const o = s.originalRect;
        const c = s.currentRect;

        if (!posMoved && !sizeChanged) {
            out += `- ${s.label} — unchanged at (${Math.round(c.x)}, ${Math.round(c.y)}) ${Math.round(c.width)}×${Math.round(c.height)}px\n`;
            continue;
        }

        // --- Compact: target only, no spatial context ---
        if (detailLevel === "compact") {
            if (posMoved && sizeChanged) {
                out += `- Suggested: move **${s.label}** to (${Math.round(c.x)}, ${Math.round(c.y)}) ${Math.round(c.width)}×${Math.round(c.height)}px\n`;
            } else if (posMoved) {
                out += `- Suggested: move **${s.label}** to (${Math.round(c.x)}, ${Math.round(c.y)})\n`;
            } else {
                out += `- Suggested: resize **${s.label}** to ${Math.round(c.width)}×${Math.round(c.height)}px\n`;
            }

            continue;
        }

        // --- Standard / Detailed / Forensic: spatial context with coordinates ---
        if (posMoved && sizeChanged) {
            out += `- Suggested: move and resize **${s.label}**\n`;
        } else if (posMoved) {
            out += `- Suggested: move **${s.label}**\n`;
        } else {
            out += `- Suggested: resize **${s.label}** from ${Math.round(o.width)}×${Math.round(o.height)}px to ${Math.round(c.width)}×${Math.round(c.height)}px\n`;
        }

        if (posMoved) {
            const origCtx = getSpatialContext(o, siblingCandidates("original"));
            const currCtx = getSpatialContext(c, siblingCandidates("current"));

            // Currently at: coordinates + size (if resized) + spatial context
            const wasSize = sizeChanged ? { height: o.height, width: o.width } : undefined;

            out += `  - Currently ${formatPositionSummary(origCtx, { x: o.x, y: o.y }, wasSize)}\n`;

            // Suggested position: coordinates + size (if resized) + spatial context with gap values
            const nowSize = sizeChanged ? { height: c.height, width: c.width } : undefined;
            const coordStr = `at (${Math.round(c.x)}, ${Math.round(c.y)})`;
            const sizeStr = nowSize ? `, ${Math.round(nowSize.width)}×${Math.round(nowSize.height)}px` : "";
            const includeLeftRight = detailLevel === "detailed" || detailLevel === "forensic";
            const nowLines = formatSpatialLines(currCtx, { includeLeftRight });

            if (nowLines.length > 0) {
                out += `  - Suggested position ${coordStr}${sizeStr}: ${nowLines[0]}\n`;

                for (let i = 1; i < nowLines.length; i++) {
                    out += `    ${nowLines[i]}\n`;
                }
            } else {
                out += `  - Suggested position ${coordStr}${sizeStr}\n`;
            }

            // CSS position relative to content area
            const cssPos = formatCSSPosition(c, layout);

            if (cssPos) {
                out += `  - CSS: ${cssPos}\n`;
            }
        }

        // Parent layout context (standard+)
        const parentCtx = formatParentContext(s.selector);

        if (parentCtx) {
            out += `  - ${parentCtx}\n`;
        }

        // Selector
        out += `  - Selector: \`${s.selector}\`\n`;

        // Detailed/Forensic extras
        if (detailLevel === "detailed" || detailLevel === "forensic") {
            const ident = s.className ? `${s.tagName}.${s.className.split(" ")[0]}` : s.tagName;

            if (ident !== s.selector) {
                out += `  - Element: \`${ident}\`\n`;
            }

            if (s.role)
                out += `  - Role: \`${s.role}\`\n`;

            if (detailLevel === "forensic" && s.textSnippet) {
                out += `  - Text: "${s.textSnippet}"\n`;
            }
        }

        // Forensic: full structured rects
        if (detailLevel === "forensic") {
            out += `  - Original rect: \`{ x: ${Math.round(o.x)}, y: ${Math.round(o.y)}, w: ${Math.round(o.width)}, h: ${Math.round(o.height)} }\`\n`;
            out += `  - Current rect: \`{ x: ${Math.round(c.x)}, y: ${Math.round(c.y)}, w: ${Math.round(c.width)}, h: ${Math.round(c.height)} }\`\n`;
        }
    }

    // --- Layout Summary (standard+, not compact) ---
    if (detailLevel !== "compact") {
        const movedSections = changed
            .filter((e) => e.posMoved)
            .map((e) => {
                return {
                    currentRect: e.section.currentRect,
                    label: e.section.label,
                    originalRect: e.section.originalRect,
                };
            });

        const patterns = analyzeLayoutPatterns(movedSections);

        if (patterns.length > 0) {
            out += "\n### Layout Summary\n";

            for (const line of patterns) {
                out += `- ${line}\n`;
            }
        }
    }

    // --- All Sections Snapshot (standard+) ---
    // Gives the implementing agent full layout context
    if (detailLevel !== "compact" && sections.length > 1) {
        out += "\n### All Sections (current positions)\n";
        const sortedSections = sections.toSorted((a, b) => {
            if (Math.abs(a.currentRect.y - b.currentRect.y) < 20)
                return a.currentRect.x - b.currentRect.x;

            return a.currentRect.y - b.currentRect.y;
        });

        for (const s of sortedSections) {
            const r = s.currentRect;
            const moved = Math.abs(r.x - s.originalRect.x) > 1 || Math.abs(r.y - s.originalRect.y) > 1
                || Math.abs(r.width - s.originalRect.width) > 1 || Math.abs(r.height - s.originalRect.height) > 1;

            out += `- ${s.label}: \`${Math.round(r.width)}×${Math.round(r.height)}px\` at \`(${Math.round(r.x)}, ${Math.round(r.y)})\`${moved ? " ← suggested" : ""}\n`;
        }
    }

    return out;
};
