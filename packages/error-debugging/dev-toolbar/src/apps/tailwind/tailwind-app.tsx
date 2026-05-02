/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { TailwindConfigResult } from "../../rpc/functions/tailwind-config";
import type { AppComponentProps } from "../../types/app";

type Tab = "colors" | "spacing" | "type" | "effects" | "config";

// ─── Module-scope regex constants ─────────────────────────────────────────────

const NUMERIC_SCALE_RE = /^\w+-\d+$/;
const TRAILING_NUMBER_RE = /-\d+$/;
const TRAILING_NUMBER_CAPTURE_RE = /-(\d+)$/;
const CSS_VAR_PREFIX_RE = /^--/;

// ─── CSS variable scanner ─────────────────────────────────────────────────────

/**
 * Collect CSS custom properties from :root / html rules.
 * Recurses into \@layer, \@media, and \@supports blocks because Tailwind v4
 * wraps its theme tokens inside `\@layer theme { :root { ... } }`.
 */
const isRootSelector = (selectorText: string): boolean =>
    selectorText.split(",").some((s) => {
        const t = s.trim();

        return t === ":root" || t === "html";
    });

const collectRootStyleVariables = (style: CSSStyleDeclaration, variables: Map<string, string>): void => {
    for (let i = 0; i < style.length; i += 1) {
        const prop = style[i] as string;

        if (prop.startsWith("--") && !prop.startsWith("--tw-") && !prop.startsWith("--brand-")) {
            const value = style.getPropertyValue(prop).trim();

            if (value) {
                variables.set(prop, value);
            }
        }
    }
};

const collectVariablesFromRules = (rules: CSSRuleList, variables: Map<string, string>): void => {
    for (const rule of rules) {
        if (rule instanceof CSSStyleRule) {
            if (isRootSelector(rule.selectorText)) {
                collectRootStyleVariables(rule.style, variables);
            }
        } else if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
            // Recurse into \@layer, \@media, \@supports, and any other grouping rule
            collectVariablesFromRules(rule.cssRules, variables);
        }
    }
};

const scanRootVariables = (): Map<string, string> => {
    const variables = new Map<string, string>();

    for (const sheet of document.styleSheets) {
        try {
            collectVariablesFromRules(sheet.cssRules, variables);
        } catch {
            // CORS — skip cross-origin stylesheets
        }
    }

    return variables;
};

// ─── Token types ──────────────────────────────────────────────────────────────

interface ColorToken {
    cssVar: string;
    name: string;
    value: string;
}

interface SpacingToken {
    cssVar: string;
    name: string;
    numericPx: number;
    value: string;
}

interface FontSizeToken {
    cssVar: string;
    name: string;
    sizePx: number;
    value: string;
}

interface EffectToken {
    cssVar: string;
    name: string;
    value: string;
}

interface TokenSet {
    colors: ColorToken[];
    fontFamilies: EffectToken[];
    fontSizes: FontSizeToken[];
    radii: EffectToken[];
    shadows: EffectToken[];
    spacing: SpacingToken[];
}

// ─── Token extraction ─────────────────────────────────────────────────────────

const parseToPx = (value: string): number => {
    if (value.endsWith("rem")) {
        return Number.parseFloat(value) * 16;
    }

    if (value.endsWith("px")) {
        return Number.parseFloat(value);
    }

    if (value.endsWith("em")) {
        return Number.parseFloat(value) * 16;
    }

    return 0;
};

const extractTokens = (variables: Map<string, string>): TokenSet => {
    const colors: ColorToken[] = [];
    const spacing: SpacingToken[] = [];
    const fontSizes: FontSizeToken[] = [];
    const fontFamilies: EffectToken[] = [];
    const radii: EffectToken[] = [];
    const shadows: EffectToken[] = [];

    for (const [prop, value] of variables) {
        if (prop.startsWith("--color-")) {
            colors.push({ cssVar: prop, name: prop.slice(8), value });
        } else if (prop.startsWith("--spacing-")) {
            spacing.push({
                cssVar: prop,
                name: prop.slice(10),
                numericPx: parseToPx(value),
                value,
            });
        } else if (prop.startsWith("--text-") && !prop.includes("--line-height") && !prop.endsWith("--font-weight")) {
            fontSizes.push({
                cssVar: prop,
                name: prop.slice(7),
                sizePx: parseToPx(value),
                value,
            });
        } else if (prop.startsWith("--font-")) {
            fontFamilies.push({ cssVar: prop, name: prop.slice(7), value });
        } else if (prop.startsWith("--radius-")) {
            radii.push({ cssVar: prop, name: prop.slice(9), value });
        } else if (prop.startsWith("--shadow-") || prop.startsWith("--drop-shadow-")) {
            shadows.push({ cssVar: prop, name: prop.slice(2), value });
        }
    }

    const sortedSpacing = spacing.toSorted((a, b) => a.numericPx - b.numericPx);
    const sortedFontSizes = fontSizes.toSorted((a, b) => a.sizePx - b.sizePx);

    return { colors, fontFamilies, fontSizes: sortedFontSizes, radii, shadows, spacing: sortedSpacing };
};

// ─── Color grouping ───────────────────────────────────────────────────────────

const isNumericScale = (name: string): boolean => NUMERIC_SCALE_RE.test(name);

const groupColors = (colors: ColorToken[]): { scales: Map<string, ColorToken[]>; semantic: ColorToken[] } => {
    const semantic: ColorToken[] = [];
    const scaleMap = new Map<string, ColorToken[]>();

    for (const token of colors) {
        if (isNumericScale(token.name)) {
            const scaleName = token.name.replace(TRAILING_NUMBER_RE, "");
            const existing = scaleMap.get(scaleName) ?? [];

            existing.push(token);
            scaleMap.set(scaleName, existing);
        } else {
            semantic.push(token);
        }
    }

    for (const [key, tokens] of scaleMap) {
        scaleMap.set(
            key,
            tokens.toSorted((a, b) => {
                const numberA = Number.parseInt(a.name.match(TRAILING_NUMBER_CAPTURE_RE)?.[1] ?? "0", 10);
                const numberB = Number.parseInt(b.name.match(TRAILING_NUMBER_CAPTURE_RE)?.[1] ?? "0", 10);

                return numberA - numberB;
            }),
        );
    }

    return { scales: scaleMap, semantic };
};

// ─── Copy button hook ─────────────────────────────────────────────────────────

const useCopy = (): { copied: boolean; copy: (text: string) => void } => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const copy = (text: string): void => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);

        if (timer.current) {
            clearTimeout(timer.current);
        }

        timer.current = setTimeout(setCopied, 1500, false);
    };

    return { copied, copy };
};

// ─── Section header ───────────────────────────────────────────────────────────

const SectionTitle = ({ count, title }: { count?: number; title: string }): ComponentChildren => (
    <div class="flex items-center gap-2 px-3 py-1.5 bg-foreground/3 border-b border-border/40">
        <span class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            <span class="text-primary/50">// </span>
            {title}
        </span>
        {count !== undefined && count > 0 && <span class="ml-auto text-[0.58rem] font-mono text-muted-foreground/50">{count}</span>}
    </div>
);

// ─── Color item ───────────────────────────────────────────────────────────────

const ColorItem = ({ token }: { token: ColorToken }): ComponentChildren => {
    const { copied, copy } = useCopy();

    return (
        <button
            class="group flex items-center gap-2.5 w-full text-left hover:bg-foreground/4 px-3 py-1.5 transition-colors cursor-pointer bg-transparent border-0"
            onClick={() => {
                copy(token.cssVar);
            }}
            title={`Click to copy ${token.cssVar}`}
            type="button"
        >
            <span class="shrink-0 size-5 border border-black/10 dark:border-white/10" style={{ background: `var(${token.cssVar})` }} />
            <span class="flex-1 min-w-0">
                <span class="block text-[0.68rem] font-mono text-foreground truncate">{token.name}</span>
                <span class="block text-[0.6rem] font-mono text-muted-foreground/60 truncate">{token.value}</span>
            </span>
            <span
                class={clsx(
                    "text-[0.6rem] font-mono shrink-0 transition-opacity",
                    copied ? "text-primary opacity-100" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100",
                )}
            >
                {copied ? "copied!" : "copy"}
            </span>
        </button>
    );
};

// ─── Color scale row ──────────────────────────────────────────────────────────

const ColorScaleRow = ({ name, tokens }: { name: string; tokens: ColorToken[] }): ComponentChildren => {
    const { copied, copy } = useCopy();

    return (
        <div class="px-3 py-2">
            <div class="flex items-center gap-2 mb-1.5">
                <span class="text-[0.65rem] font-mono text-muted-foreground/70 w-16 shrink-0">{name}</span>
                <div class="flex flex-1 gap-px overflow-hidden">
                    {tokens.map((t) => (
                        <button
                            class="flex-1 h-5 border-0 cursor-pointer transition-transform hover:scale-110 hover:z-10"
                            key={t.cssVar}
                            onClick={() => {
                                copy(t.cssVar);
                            }}
                            style={{ background: `var(${t.cssVar})`, minWidth: 0 }}
                            title={`${t.name}\n${t.value}\nClick to copy ${t.cssVar}`}
                            type="button"
                        />
                    ))}
                </div>
            </div>
            {copied && <span class="text-[0.6rem] font-mono text-primary/70 pl-[72px]">copied!</span>}
        </div>
    );
};

// ─── Colors tab ───────────────────────────────────────────────────────────────

const ColorsTab = ({ colors }: { colors: ColorToken[] }): ComponentChildren => {
    const { scales, semantic } = useMemo(() => groupColors(colors), [colors]);

    if (colors.length === 0) {
        return (
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <span class="text-3xl text-muted-foreground/20">◫</span>
                <p class="text-[0.75rem] text-muted-foreground/60">No color tokens found</p>
                <p class="text-[0.65rem] text-muted-foreground/40 leading-relaxed">
                    Color tokens are read from <code class="font-mono">--color-*</code> CSS variables on <code class="font-mono">:root</code>
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Semantic tokens */}
            {semantic.length > 0 && (
                <div class="border-b border-border/40">
                    <SectionTitle count={semantic.length} title="Semantic" />
                    <div class="py-1">
                        {semantic.map((token) => (
                            <ColorItem key={token.cssVar} token={token} />
                        ))}
                    </div>
                </div>
            )}

            {/* Color scales */}
            {scales.size > 0 && (
                <div>
                    <SectionTitle count={scales.size} title="Palette" />
                    <div class="py-1 divide-y divide-border/20">
                        {Array.from(scales.entries(), ([name, tokens]) => (
                            <ColorScaleRow key={name} name={name} tokens={tokens} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Spacing tab ──────────────────────────────────────────────────────────────

const SpacingTab = ({ spacing }: { spacing: SpacingToken[] }): ComponentChildren => {
    const maxPx = useMemo(() => Math.max(...spacing.map((s) => s.numericPx), 1), [spacing]);

    if (spacing.length === 0) {
        return (
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <span class="text-3xl text-muted-foreground/20">↔</span>
                <p class="text-[0.75rem] text-muted-foreground/60">No spacing tokens found</p>
                <p class="text-[0.65rem] text-muted-foreground/40 leading-relaxed">
                    Spacing tokens are read from <code class="font-mono">--spacing-*</code> CSS variables
                </p>
            </div>
        );
    }

    return (
        <div class="p-3 space-y-1">
            {spacing.map((token) => {
                const barPct = maxPx > 0 ? Math.max((token.numericPx / maxPx) * 100, 2) : 2;

                return (
                    <div class="flex items-center gap-2.5" key={token.cssVar}>
                        <span class="text-[0.62rem] font-mono text-muted-foreground/70 w-8 shrink-0 text-right">{token.name}</span>
                        <div class="flex-1 flex items-center gap-1.5">
                            <div class="flex-1 h-3.5 bg-foreground/5 border border-border/30 overflow-hidden">
                                <div class="h-full bg-primary/30 border-r border-primary/40" style={{ width: `${barPct}%` }} />
                            </div>
                        </div>
                        <code class="text-[0.62rem] font-mono text-muted-foreground/60 w-14 text-right shrink-0">{token.value}</code>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Typography tab ───────────────────────────────────────────────────────────

const TypographyTab = ({ fontFamilies, fontSizes }: { fontFamilies: EffectToken[]; fontSizes: FontSizeToken[] }): ComponentChildren => {
    if (fontSizes.length === 0 && fontFamilies.length === 0) {
        return (
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <span class="text-3xl text-muted-foreground/20">Aa</span>
                <p class="text-[0.75rem] text-muted-foreground/60">No typography tokens found</p>
                <p class="text-[0.65rem] text-muted-foreground/40 leading-relaxed">
                    Font size tokens are read from <code class="font-mono">--text-*</code> and font family tokens from <code class="font-mono">--font-*</code>
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Font sizes */}
            {fontSizes.length > 0 && (
                <div class="border-b border-border/40">
                    <SectionTitle count={fontSizes.length} title="Font Sizes" />
                    <div class="p-3 space-y-1.5">
                        {fontSizes.map((token) => {
                            const clampedPx = Math.min(token.sizePx || 14, 48);

                            return (
                                <div class="flex items-center gap-3" key={token.cssVar}>
                                    <span class="text-[0.6rem] font-mono text-muted-foreground/60 w-10 shrink-0 text-right">{token.name}</span>
                                    <span class="text-foreground leading-none truncate flex-1" style={{ fontSize: `${clampedPx}px` }}>
                                        Ag
                                    </span>
                                    <code class="text-[0.62rem] font-mono text-muted-foreground/60 shrink-0">{token.value}</code>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Font families */}
            {fontFamilies.length > 0 && (
                <div>
                    <SectionTitle count={fontFamilies.length} title="Font Families" />
                    <div class="p-3 space-y-2">
                        {fontFamilies.map((token) => (
                            <div class="space-y-0.5" key={token.cssVar}>
                                <div class="flex items-center justify-between gap-2">
                                    <code class="text-[0.68rem] font-mono text-foreground">{token.name}</code>
                                </div>
                                <p class="text-[0.75rem] text-foreground/70 truncate" style={{ fontFamily: `var(${token.cssVar})` }}>
                                    The quick brown fox
                                </p>
                                <code class="block text-[0.58rem] font-mono text-muted-foreground/50 truncate">{token.value}</code>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Effects tab ──────────────────────────────────────────────────────────────

const EffectsTab = ({ radii, shadows }: { radii: EffectToken[]; shadows: EffectToken[] }): ComponentChildren => {
    if (radii.length === 0 && shadows.length === 0) {
        return (
            <div class="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                <span class="text-3xl text-muted-foreground/20">◻</span>
                <p class="text-[0.75rem] text-muted-foreground/60">No effect tokens found</p>
                <p class="text-[0.65rem] text-muted-foreground/40 leading-relaxed">
                    Radius tokens from <code class="font-mono">--radius-*</code> and shadow tokens from <code class="font-mono">--shadow-*</code>
                </p>
            </div>
        );
    }

    return (
        <div>
            {/* Border radius */}
            {radii.length > 0 && (
                <div class="border-b border-border/40">
                    <SectionTitle count={radii.length} title="Border Radius" />
                    <div class="p-3 flex flex-wrap gap-3">
                        {radii.map((token) => (
                            <div class="flex flex-col items-center gap-1.5" key={token.cssVar}>
                                <div class="size-10 border-2 border-primary/40 bg-primary/8" style={{ borderRadius: `var(${token.cssVar})` }} />
                                <code class="text-[0.6rem] font-mono text-muted-foreground/70">{token.name}</code>
                                <code class="text-[0.58rem] font-mono text-muted-foreground/50">{token.value}</code>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Shadows */}
            {shadows.length > 0 && (
                <div>
                    <SectionTitle count={shadows.length} title="Shadows" />
                    <div class="p-3 space-y-3">
                        {shadows.map((token) => (
                            <div class="space-y-1.5" key={token.cssVar}>
                                <div class="flex items-center justify-between gap-2">
                                    <code class="text-[0.68rem] font-mono text-foreground">{token.name}</code>
                                </div>
                                <div class="h-10 bg-card border border-border/40" style={{ boxShadow: `var(${token.cssVar})` }} />
                                <code class="block text-[0.58rem] font-mono text-muted-foreground/50 truncate">{token.value}</code>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Config tab (server-side full theme) ──────────────────────────────────────

const ConfigColorScaleRow = ({ name, tokens }: { name: string; tokens: [string, string][] }): ComponentChildren => {
    const { copied, copy } = useCopy();

    return (
        <div class="px-3 py-2">
            <div class="flex items-center gap-2 mb-1">
                <span class="text-[0.65rem] font-mono text-muted-foreground/70 w-16 shrink-0">{name}</span>
                <div class="flex flex-1 gap-px overflow-hidden">
                    {tokens.map(([variableName, value]) => (
                        <button
                            class="flex-1 h-5 border-0 cursor-pointer transition-transform hover:scale-110 hover:z-10"
                            key={variableName}
                            onClick={() => {
                                copy(variableName);
                            }}
                            style={{ background: value }}
                            title={`${variableName}\n${value}\nClick to copy`}
                            type="button"
                        />
                    ))}
                </div>
            </div>
            {copied && <span class="text-[0.6rem] font-mono text-primary/70 pl-[72px]">copied!</span>}
        </div>
    );
};

const ConfigSemanticColorItem = ({ cssVar, isCustom, value }: { cssVar: string; isCustom: boolean; value: string }): ComponentChildren => {
    const { copied, copy } = useCopy();
    const name = cssVar.slice(8); // strip --color-

    return (
        <button
            class="group flex items-center gap-2.5 w-full text-left hover:bg-foreground/4 px-3 py-1.5 transition-colors cursor-pointer bg-transparent border-0"
            onClick={() => {
                copy(cssVar);
            }}
            title={`Click to copy ${cssVar}`}
            type="button"
        >
            <span class="shrink-0 size-5 border border-black/10" style={{ background: value }} />
            <span class="flex-1 min-w-0">
                <span class="flex items-center gap-1.5">
                    <span class="text-[0.68rem] font-mono text-foreground truncate">{name}</span>
                    {isCustom && <span class="text-[0.55rem] font-bold uppercase tracking-wide text-primary/70 bg-primary/10 px-1">custom</span>}
                </span>
                <span class="block text-[0.6rem] font-mono text-muted-foreground/60 truncate">{value}</span>
            </span>
            <span
                class={clsx(
                    "text-[0.6rem] font-mono shrink-0 transition-opacity",
                    copied ? "text-primary opacity-100" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100",
                )}
            >
                {copied ? "copied!" : "copy"}
            </span>
        </button>
    );
};

// ─── Collapsible section for Config tab ──────────────────────────────────────

const ConfigSection = ({
    children,
    count,
    defaultOpen = true,
    title,
}: {
    children: ComponentChildren;
    count: number;
    defaultOpen?: boolean;
    title: string;
}): ComponentChildren => {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div class="border-b border-border/40">
            <button
                class="w-full flex items-center gap-2 px-3 py-1.5 bg-foreground/3 hover:bg-foreground/5 transition-colors cursor-pointer border-0 text-left"
                onClick={() => {
                    setOpen((o) => !o);
                }}
                type="button"
            >
                <span class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/70 flex-1">
                    <span class="text-primary/50">// </span>
                    {title}
                </span>
                <span class="text-[0.58rem] font-mono text-muted-foreground/50">{count}</span>
                <span class={clsx("text-muted-foreground/40 text-[0.6rem] transition-transform duration-150 ml-1", open && "rotate-90")}>▶</span>
            </button>
            {open && children}
        </div>
    );
};

// ─── Simple token row for non-color tokens ────────────────────────────────────

const ConfigTokenRow = ({ cssVar, isCustom, value }: { cssVar: string; isCustom: boolean; value: string }): ComponentChildren => {
    const { copied, copy } = useCopy();
    const name = cssVar.replace(CSS_VAR_PREFIX_RE, "");

    return (
        <button
            class="group flex items-center gap-2.5 w-full text-left hover:bg-foreground/4 px-3 py-1.5 transition-colors cursor-pointer bg-transparent border-0"
            onClick={() => {
                copy(cssVar);
            }}
            type="button"
        >
            <span class="flex-1 min-w-0">
                <span class="flex items-center gap-1.5">
                    <code class="text-[0.68rem] font-mono text-foreground truncate">{name}</code>
                    {isCustom && <span class="text-[0.55rem] font-bold uppercase tracking-wide text-primary/70 bg-primary/10 px-1 shrink-0">custom</span>}
                </span>
            </span>
            <code class="text-[0.62rem] font-mono text-muted-foreground/60 truncate max-w-[160px] shrink-0">{value}</code>
            <span
                class={clsx(
                    "text-[0.6rem] font-mono shrink-0 transition-opacity w-8 text-right",
                    copied ? "text-primary opacity-100" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100",
                )}
            >
                {copied ? "✓" : "copy"}
            </span>
        </button>
    );
};

const ConfigTab = ({
    configData,
    error,
    loading,
    onRetry,
}: {
    configData: TailwindConfigResult | undefined;
    error: string | undefined;
    loading: boolean;
    onRetry: () => void;
}): ComponentChildren => {
    const [colorSearch, setColorSearch] = useState("");

    if (loading) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
                <div aria-hidden="true" class="flex gap-1.5 items-center">
                    {([0, 160, 320] as const).map((delay) => (
                        <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
                    ))}
                </div>
                <span class="text-[0.75rem] text-muted-foreground">Loading Tailwind config…</span>
            </div>
        );
    }

    if (error || !configData) {
        return (
            <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
                <p class="text-[0.8rem] text-destructive">{error ?? "No config available"}</p>
                <button
                    class="px-3 py-1.5 text-[0.75rem] border border-border text-muted-foreground hover:text-foreground cursor-pointer bg-transparent"
                    onClick={onRetry}
                    type="button"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { cssFiles, customTheme, defaultTheme, version } = configData;

    // Merge: custom overrides take priority over default for display
    const allVariables = { ...defaultTheme, ...customTheme };

    // ── Color partitioning ──
    const colorEntries = Object.entries(allVariables).filter(([k]) => k.startsWith("--color-"));
    const semanticColors = colorEntries.filter(([k]) => !isNumericScale(k.slice(8)));
    const scaleColors = colorEntries.filter(([k]) => isNumericScale(k.slice(8)));

    const scaleMap = new Map<string, [string, string][]>();

    for (const [cssVariable, value] of scaleColors) {
        const scaleName = cssVariable.slice(8).replace(TRAILING_NUMBER_RE, "");
        const existing = scaleMap.get(scaleName) ?? [];

        existing.push([cssVariable, value]);
        scaleMap.set(scaleName, existing);
    }

    for (const [key, tokens] of scaleMap) {
        scaleMap.set(
            key,
            tokens.toSorted((a, b) => {
                const numberA = Number.parseInt(a[0].match(TRAILING_NUMBER_CAPTURE_RE)?.[1] ?? "0", 10);
                const numberB = Number.parseInt(b[0].match(TRAILING_NUMBER_CAPTURE_RE)?.[1] ?? "0", 10);

                return numberA - numberB;
            }),
        );
    }

    const filteredScales = colorSearch
        ? [...scaleMap.entries()].filter(([name]) => name.toLowerCase().includes(colorSearch.toLowerCase()))
        : [...scaleMap.entries()];

    // ── Non-color token groups ──
    const spacingEntries = Object.entries(allVariables)
        .filter(([k]) => k.startsWith("--spacing-"))
        .toSorted(([, a], [, b]) => parseToPx(a) - parseToPx(b));

    const fontFamilyEntries = Object.entries(allVariables).filter(([k]) => k.startsWith("--font-"));

    const fontSizeEntries = Object.entries(allVariables)
        .filter(([k]) => k.startsWith("--text-") && !k.includes("--line-height") && !k.endsWith("--font-weight"))
        .toSorted(([, a], [, b]) => parseToPx(a) - parseToPx(b));

    const breakpointEntries = Object.entries(allVariables)
        .filter(([k]) => k.startsWith("--breakpoint-"))
        .toSorted(([, a], [, b]) => parseToPx(a) - parseToPx(b));

    const radiusEntries = Object.entries(allVariables).filter(([k]) => k.startsWith("--radius-"));

    const shadowEntries = Object.entries(allVariables).filter(([k]) => k.startsWith("--shadow-") || k.startsWith("--drop-shadow-"));

    const blurEntries = Object.entries(allVariables).filter(([k]) => k.startsWith("--blur-"));

    const animateEntries = Object.entries(allVariables).filter(([k]) => k.startsWith("--animate-"));

    // Everything not covered above
    const knownPrefixes = [
        "--color-",
        "--spacing-",
        "--font-",
        "--text-",
        "--breakpoint-",
        "--radius-",
        "--shadow-",
        "--drop-shadow-",
        "--blur-",
        "--animate-",
        "--tw-",
        "--brand-",
    ];
    const otherEntries = Object.entries(allVariables).filter(([k]) => !knownPrefixes.some((p) => k.startsWith(p)));

    // Max spacing for bar widths
    let maxSpacingPx = 1;

    for (const [, v] of spacingEntries) {
        maxSpacingPx = Math.max(maxSpacingPx, parseToPx(v));
    }

    return (
        <div>
            {/* Meta bar */}
            <div class="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-foreground/2 shrink-0">
                <span
                    class={clsx(
                        "text-[0.6rem] font-bold uppercase tracking-wide px-1.5 py-0.5 shrink-0",
                        version === "v4" && "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20",
                        version === "v3" && "bg-primary/10 text-primary border border-primary/20",
                        version === "unknown" && "bg-foreground/8 text-muted-foreground border border-border",
                    )}
                >
                    {version === "unknown" ? "Tailwind" : `Tailwind ${version}`}
                </span>
                {cssFiles.length > 0 && (
                    <code class="text-[0.62rem] font-mono text-muted-foreground/70 truncate flex-1">
                        {cssFiles[0]}
                        {cssFiles.length > 1 && <span class="text-muted-foreground/40"> +{cssFiles.length - 1}</span>}
                    </code>
                )}
                <span class="text-[0.6rem] font-mono text-muted-foreground/50 shrink-0">{Object.keys(allVariables).length} tokens</span>
            </div>

            {/* Custom overrides */}
            {Object.keys(customTheme).length > 0 && (
                <ConfigSection count={Object.keys(customTheme).length} title="Custom Overrides">
                    <div class="py-1">
                        {Object.entries(customTheme).map(([cssVariable, value]) => {
                            const isSemanticColor = cssVariable.startsWith("--color-") && !isNumericScale(cssVariable.slice(8));

                            if (isSemanticColor) {
                                return <ConfigSemanticColorItem cssVar={cssVariable} isCustom key={cssVariable} value={value} />;
                            }

                            return <ConfigTokenRow cssVar={cssVariable} isCustom key={cssVariable} value={value} />;
                        })}
                    </div>
                </ConfigSection>
            )}

            {/* Semantic colors */}
            {semanticColors.length > 0 && (
                <ConfigSection count={semanticColors.length} title="Semantic Colors">
                    <div class="py-1">
                        {semanticColors.map(([cssVariable, value]) => (
                            <ConfigSemanticColorItem cssVar={cssVariable} isCustom={cssVariable in customTheme} key={cssVariable} value={value} />
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Color palette */}
            {scaleMap.size > 0 && (
                <ConfigSection count={scaleMap.size} defaultOpen={false} title="Color Palette">
                    <div class="px-3 pt-2 pb-1 border-b border-border/20">
                        <input
                            class="w-full bg-foreground/4 border border-border/40 px-2 py-1 text-[0.68rem] font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40"
                            onInput={(event_) => {
                                setColorSearch((event_.target as HTMLInputElement).value);
                            }}
                            placeholder="Filter scales…"
                            type="text"
                            value={colorSearch}
                        />
                    </div>
                    <div class="py-1 divide-y divide-border/20">
                        {filteredScales.map(([name, tokens]) => (
                            <ConfigColorScaleRow key={name} name={name} tokens={tokens} />
                        ))}
                        {filteredScales.length === 0 && <p class="text-center text-[0.7rem] text-muted-foreground/50 py-4">No colors match</p>}
                    </div>
                </ConfigSection>
            )}

            {/* Spacing */}
            {spacingEntries.length > 0 && (
                <ConfigSection count={spacingEntries.length} defaultOpen={false} title="Spacing">
                    <div class="p-3 space-y-1">
                        {spacingEntries.map(([cssVariable, value]) => {
                            const px = parseToPx(value);
                            const barPct = maxSpacingPx > 0 ? Math.max((px / maxSpacingPx) * 100, 1) : 1;

                            return (
                                <div class="flex items-center gap-2.5" key={cssVariable}>
                                    <span class="text-[0.62rem] font-mono text-muted-foreground/70 w-10 shrink-0 text-right">{cssVariable.slice(10)}</span>
                                    <div class="flex-1 h-3 bg-foreground/5 border border-border/30 overflow-hidden">
                                        <div class="h-full bg-primary/30 border-r border-primary/40" style={{ width: `${barPct}%` }} />
                                    </div>
                                    <code class="text-[0.62rem] font-mono text-muted-foreground/60 w-14 text-right shrink-0">{value}</code>
                                </div>
                            );
                        })}
                    </div>
                </ConfigSection>
            )}

            {/* Breakpoints */}
            {breakpointEntries.length > 0 && (
                <ConfigSection count={breakpointEntries.length} defaultOpen={false} title="Breakpoints">
                    <div class="p-3 space-y-1.5">
                        {breakpointEntries.map(([cssVariable, value]) => (
                            <ConfigTokenRow cssVar={cssVariable} isCustom={cssVariable in customTheme} key={cssVariable} value={value} />
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Font families */}
            {fontFamilyEntries.length > 0 && (
                <ConfigSection count={fontFamilyEntries.length} defaultOpen={false} title="Font Families">
                    <div class="p-3 space-y-2">
                        {fontFamilyEntries.map(([cssVariable, value]) => (
                            <div class="space-y-0.5" key={cssVariable}>
                                <code class="text-[0.68rem] font-mono text-foreground">{cssVariable.slice(7)}</code>
                                <p class="text-[0.75rem] text-foreground/70 truncate" style={{ fontFamily: value.startsWith("--theme(") ? "inherit" : value }}>
                                    The quick brown fox
                                </p>
                                <code class="block text-[0.58rem] font-mono text-muted-foreground/50 truncate">{value}</code>
                            </div>
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Font sizes */}
            {fontSizeEntries.length > 0 && (
                <ConfigSection count={fontSizeEntries.length} defaultOpen={false} title="Font Sizes">
                    <div class="p-3 space-y-1.5">
                        {fontSizeEntries.map(([cssVariable, value]) => {
                            const clampedPx = Math.min(parseToPx(value) || 14, 48);

                            return (
                                <div class="flex items-center gap-3" key={cssVariable}>
                                    <span class="text-[0.6rem] font-mono text-muted-foreground/60 w-12 shrink-0 text-right">{cssVariable.slice(7)}</span>
                                    <span class="text-foreground leading-none truncate flex-1" style={{ fontSize: `${clampedPx}px` }}>
                                        Ag
                                    </span>
                                    <code class="text-[0.62rem] font-mono text-muted-foreground/60 shrink-0">{value}</code>
                                </div>
                            );
                        })}
                    </div>
                </ConfigSection>
            )}

            {/* Border radius */}
            {radiusEntries.length > 0 && (
                <ConfigSection count={radiusEntries.length} defaultOpen={false} title="Border Radius">
                    <div class="p-3 flex flex-wrap gap-3">
                        {radiusEntries.map(([cssVariable, value]) => (
                            <div class="flex flex-col items-center gap-1.5" key={cssVariable}>
                                <div
                                    class="size-10 border-2 border-primary/40 bg-primary/8"
                                    style={{ borderRadius: value.startsWith("--theme(") ? "4px" : value }}
                                />
                                <code class="text-[0.6rem] font-mono text-muted-foreground/70">{cssVariable.slice(9)}</code>
                                <code class="text-[0.58rem] font-mono text-muted-foreground/50">{value}</code>
                            </div>
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Shadows */}
            {shadowEntries.length > 0 && (
                <ConfigSection count={shadowEntries.length} defaultOpen={false} title="Shadows">
                    <div class="p-3 space-y-3">
                        {shadowEntries.map(([cssVariable, value]) => (
                            <div class="space-y-1" key={cssVariable}>
                                <code class="text-[0.68rem] font-mono text-foreground">{cssVariable.slice(2)}</code>
                                {!value.startsWith("--theme(") && <div class="h-8 bg-card border border-border/40" style={{ boxShadow: value }} />}
                                <code class="block text-[0.58rem] font-mono text-muted-foreground/50 truncate">{value}</code>
                            </div>
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Blur */}
            {blurEntries.length > 0 && (
                <ConfigSection count={blurEntries.length} defaultOpen={false} title="Blur">
                    <div class="py-1">
                        {blurEntries.map(([cssVariable, value]) => (
                            <ConfigTokenRow cssVar={cssVariable} isCustom={cssVariable in customTheme} key={cssVariable} value={value} />
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Animations */}
            {animateEntries.length > 0 && (
                <ConfigSection count={animateEntries.length} defaultOpen={false} title="Animations">
                    <div class="py-1">
                        {animateEntries.map(([cssVariable, value]) => (
                            <ConfigTokenRow cssVar={cssVariable} isCustom={cssVariable in customTheme} key={cssVariable} value={value} />
                        ))}
                    </div>
                </ConfigSection>
            )}

            {/* Other tokens */}
            {otherEntries.length > 0 && (
                <ConfigSection count={otherEntries.length} defaultOpen={false} title="Other">
                    <div class="py-1">
                        {otherEntries.map(([cssVariable, value]) => (
                            <ConfigTokenRow cssVar={cssVariable} isCustom={cssVariable in customTheme} key={cssVariable} value={value} />
                        ))}
                    </div>
                </ConfigSection>
            )}
        </div>
    );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = (): ComponentChildren => (
    <div class="flex flex-col items-center justify-center h-full gap-4 py-16 px-8 text-center select-none">
        <div class="size-12 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary/30 text-2xl">◻</div>
        <div class="space-y-1.5">
            <p class="text-[0.8rem] font-medium text-foreground/70">No design tokens detected</p>
            <p class="text-[0.7rem] text-muted-foreground leading-relaxed max-w-[240px]">
                This app reads CSS custom properties from your page's <code class="font-mono text-[0.65rem]">:root</code> selector. Make sure your app uses
                Tailwind CSS v4 or defines custom properties.
            </p>
        </div>
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const TailwindApp = ({ helpers }: AppComponentProps): ComponentChildren => {
    const [tab, setTab] = useState<Tab>("colors");
    const [configData, setConfigData] = useState<TailwindConfigResult | undefined>(undefined);
    const [configLoading, setConfigLoading] = useState(false);
    const [configError, setConfigError] = useState<string | undefined>(undefined);

    const tokensRef = useRef<ReturnType<typeof extractTokens> | undefined>(undefined);

    if (!tokensRef.current) {
        const variables = scanRootVariables();

        tokensRef.current = extractTokens(variables);
    }

    const tokens = tokensRef.current;

    const loadConfig = (): void => {
        setConfigLoading(true);
        setConfigError(undefined);

        (helpers.rpc as any)
            .getTailwindConfig()
            .then((data: TailwindConfigResult) => {
                setConfigData(data);
                setConfigLoading(false);

                return data;
            })
            .catch((error: Error) => {
                setConfigError(error.message ?? "Failed to load Tailwind config");
                setConfigLoading(false);
            });
    };

    // Load config data when the Config tab is first activated
    useEffect(() => {
        if (tab === "config" && !configData && !configLoading && !configError) {
            loadConfig();
        }
    }, [tab]);

    const total = tokens.colors.length + tokens.spacing.length + tokens.fontSizes.length + tokens.radii.length;

    const tabCounts: Record<Tab, number> = {
        colors: tokens.colors.length,
        config: configData ? Object.keys(configData.defaultTheme).length + Object.keys(configData.customTheme).length : 0,
        effects: tokens.radii.length + tokens.shadows.length,
        spacing: tokens.spacing.length,
        type: tokens.fontSizes.length + tokens.fontFamilies.length,
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: "colors", label: "Colors" },
        { id: "spacing", label: "Spacing" },
        { id: "type", label: "Type" },
        { id: "effects", label: "Effects" },
        { id: "config", label: "Config" },
    ];

    return (
        <div class="flex flex-col h-full">
            {/* Header */}
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
                <span class="text-[0.75rem] font-medium text-foreground">Design Tokens</span>
                {total > 0 && (
                    <span class="text-[0.65rem] font-mono text-muted-foreground/60 bg-foreground/5 px-2 py-0.5 border border-border/40">
                        {total} page tokens
                    </span>
                )}
            </div>

            {total === 0 && tab !== "config" ? (
                <EmptyState />
            ) : (
                <>
                    {/* Tab bar */}
                    <div class="flex border-b border-border shrink-0 overflow-x-auto">
                        {tabs.map(({ id, label }) => (
                            <button
                                class={clsx(
                                    "flex-shrink-0 px-3 py-2 text-[0.68rem] font-medium transition-colors cursor-pointer border-0 border-b-2 -mb-px",
                                    tab === id
                                        ? "text-primary border-primary bg-primary/4"
                                        : "text-muted-foreground hover:text-foreground border-transparent bg-transparent",
                                )}
                                key={id}
                                onClick={() => {
                                    setTab(id);
                                }}
                                type="button"
                            >
                                {label}
                                {tabCounts[id] > 0 && (
                                    <span class={clsx("ml-1.5 text-[0.58rem] font-mono", tab === id ? "text-primary/70" : "text-muted-foreground/50")}>
                                        {tabCounts[id]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div class="flex-1 overflow-auto devtools-content-scroll">
                        {tab === "colors" && <ColorsTab colors={tokens.colors} />}
                        {tab === "spacing" && <SpacingTab spacing={tokens.spacing} />}
                        {tab === "type" && <TypographyTab fontFamilies={tokens.fontFamilies} fontSizes={tokens.fontSizes} />}
                        {tab === "effects" && <EffectsTab radii={tokens.radii} shadows={tokens.shadows} />}
                        {tab === "config" && <ConfigTab configData={configData} error={configError} loading={configLoading} onRetry={loadConfig} />}
                    </div>
                </>
            )}
        </div>
    );
};

export default TailwindApp;
