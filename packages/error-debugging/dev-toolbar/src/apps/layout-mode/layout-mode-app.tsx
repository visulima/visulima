/** @jsxImportSource preact */
import { clsx } from "clsx";
import type { Attributes, ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { isDarkTheme } from "../inspector/theme-palette";
import { DesignMode } from "./design-mode";
import { generateDesignOutput, generateRearrangeOutput } from "./output";
import { mountLayoutModeOverlay, unmountLayoutModeOverlay } from "./overlay-mount";
import { RearrangeOverlay } from "./rearrange";
import { detectPageSections } from "./section-detection";
import {
    getLayoutModeState,
    setLayoutModeState,
    subscribeLayoutMode,
    type LayoutModeState,
} from "./store";
import { COMPONENT_REGISTRY, type ComponentType } from "./types";

type DetailLevel = LayoutModeState["detailLevel"];

const DETAIL_LEVELS: { id: DetailLevel; label: string }[] = [
    { id: "compact", label: "Compact" },
    { id: "standard", label: "Standard" },
    { id: "detailed", label: "Detailed" },
    { id: "forensic", label: "Forensic" },
];

const PaletteIcon = ({ type }: { type: ComponentType }): ComponentChildren => {
    const stroke = "currentColor";

    switch (type) {
        case "button": {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height="10" rx="3" stroke={stroke} strokeWidth="1.2" width="16" x="2" y="2" />
                </svg>
            );
        }
        case "card": {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height="11" rx="1.5" stroke={stroke} strokeWidth="1.2" width="14" x="3" y="1.5" />
                    <line stroke={stroke} strokeWidth="0.8" x1="3" x2="17" y1="6.5" y2="6.5" />
                </svg>
            );
        }
        case "footer":
        case "header":
        case "navigation": {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height={type === "navigation" ? 3 : 4} stroke={stroke} strokeWidth="1.2" width="16" x="2" y={type === "footer" ? 8 : 2} />
                </svg>
            );
        }
        case "hero": {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height="10" stroke={stroke} strokeWidth="1.2" width="16" x="2" y="2" />
                    <line stroke={stroke} strokeWidth="0.8" x1="6" x2="14" y1="7" y2="7" />
                    <line stroke={stroke} strokeWidth="0.8" x1="8" x2="12" y1="9.5" y2="9.5" />
                </svg>
            );
        }
        case "image": {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height="11" rx="1" stroke={stroke} strokeWidth="1.2" width="16" x="2" y="1.5" />
                    <circle cx="6" cy="5.5" fill={stroke} opacity="0.4" r="1" />
                    <path d="M2 11l4-3 4 3 4-2 4 3" opacity="0.4" stroke={stroke} strokeWidth="1" />
                </svg>
            );
        }
        case "input": {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height="6" rx="1.5" stroke={stroke} strokeWidth="1.2" width="16" x="2" y="4" />
                </svg>
            );
        }
        default: {
            return (
                <svg fill="none" height="14" viewBox="0 0 20 14" width="18">
                    <rect height="10" rx="2" stroke={stroke} strokeDasharray="2 1" strokeWidth="1" width="16" x="2" y="2" />
                </svg>
            );
        }
    }
};

const useLayoutModeStore = (): LayoutModeState => {
    const [state, setState] = useState<LayoutModeState>(getLayoutModeState);

    useEffect(() => subscribeLayoutMode(setState), []);

    return state;
};

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

const Section = ({ children, title }: Attributes & { children: ComponentChildren; title: string }): ComponentChildren => (
    <div class="border-b border-border/40">
        <div class="flex items-center px-3 py-1.5 bg-foreground/3">
            <span class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                <span class="text-primary/50">// </span>
                {title}
            </span>
        </div>
        {children}
    </div>
);

const LayoutModeApp = ({}: AppComponentProps): ComponentChildren => {
    const state = useLayoutModeStore();
    const { copied, copy } = useCopy();

    const totalSections = state.rearrange.sections.length;
    const totalPlacements = state.placements.length;

    const handleSelect = useCallback((type: ComponentType) => {
        setLayoutModeState((s) => ({ activeComponent: s.activeComponent === type ? null : type }));
    }, []);

    const handleClear = useCallback(() => {
        setLayoutModeState((s) => ({
            clearSignal: s.clearSignal + 1,
            placements: [],
            rearrange: { detectedAt: 0, originalOrder: [], sections: [] },
        }));
    }, []);

    const handleDetectSections = useCallback(() => {
        const sections = detectPageSections();

        setLayoutModeState({
            rearrange: {
                detectedAt: Date.now(),
                originalOrder: sections.map((s) => s.id),
                sections,
            },
        });
    }, []);

    const handleToggleBlankCanvas = useCallback(() => {
        setLayoutModeState((s) => ({ blankCanvas: !s.blankCanvas }));
    }, []);

    const handleCopyOutput = useCallback(() => {
        const viewport = { height: window.innerHeight, width: window.innerWidth };
        const designOut = generateDesignOutput(
            state.placements,
            viewport,
            { blankCanvas: state.blankCanvas, wireframePurpose: state.wireframePurpose },
            state.detailLevel,
        );
        const rearrangeOut = generateRearrangeOutput(state.rearrange, state.detailLevel, viewport);
        const combined = [designOut, rearrangeOut].filter(Boolean).join("\n\n").trim();

        copy(combined || "_no changes captured yet_");
    }, [state, copy]);

    const placementsByType = useMemo(() => {
        const map = new Map<ComponentType, number>();

        for (const p of state.placements) {
            map.set(p.type, (map.get(p.type) ?? 0) + 1);
        }

        return map;
    }, [state.placements]);

    return (
        <div class="flex flex-col h-full">
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
                <div class="flex items-center gap-2">
                    <span class="text-[0.75rem] font-medium text-foreground">Layout Mode</span>
                    {state.activeComponent ? (
                        <span class="text-[0.6rem] font-mono text-primary px-1.5 py-px bg-primary/10 border border-primary/20 rounded uppercase tracking-wider">
                            {state.activeComponent}
                        </span>
                    ) : null}
                </div>
                {totalPlacements + totalSections > 0 ? (
                    <span class="text-[0.65rem] font-mono text-muted-foreground/60 bg-foreground/5 px-2 py-0.5 border border-border/40 rounded">
                        {totalPlacements + totalSections} item{totalPlacements + totalSections === 1 ? "" : "s"}
                    </span>
                ) : null}
            </div>

            <div class="flex items-center gap-2 px-3 py-2 border-b border-border/60 shrink-0">
                <button
                    class={clsx(
                        "flex-1 text-[0.7rem] font-medium px-2 py-1.5 rounded border transition-colors cursor-pointer",
                        state.blankCanvas
                            ? "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/40"
                            : "bg-transparent text-muted-foreground border-border/60 hover:bg-foreground/5",
                    )}
                    onClick={handleToggleBlankCanvas}
                    type="button"
                >
                    {state.blankCanvas ? "Wireframe ✓" : "Wireframe"}
                </button>
                <button
                    class="flex-1 text-[0.7rem] font-medium px-2 py-1.5 rounded border border-border/60 text-muted-foreground hover:bg-foreground/5 transition-colors cursor-pointer"
                    onClick={handleDetectSections}
                    type="button"
                >
                    Detect sections
                </button>
            </div>

            {state.blankCanvas ? (
                <div class="px-3 pt-2 pb-1 border-b border-border/40 shrink-0">
                    <textarea
                        class="w-full bg-foreground/5 border border-border/40 rounded px-2 py-1.5 text-[0.7rem] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 resize-none"
                        onInput={(event_) => setLayoutModeState({ wireframePurpose: (event_.target as HTMLTextAreaElement).value })}
                        placeholder="Describe what you want to wireframe (optional, helps the agent)"
                        rows={2}
                        value={state.wireframePurpose}
                    />
                </div>
            ) : null}

            <div class="flex-1 overflow-auto devtools-content-scroll">
                {COMPONENT_REGISTRY.map((sec) => (
                    <Section key={sec.section} title={sec.section}>
                        <div class="p-1.5 grid grid-cols-2 gap-1">
                            {sec.items.map((item) => {
                                const isActive = state.activeComponent === item.type;
                                const count = placementsByType.get(item.type) ?? 0;

                                return (
                                    <button
                                        class={clsx(
                                            "flex items-center gap-1.5 px-1.5 py-1 rounded border transition-colors cursor-pointer text-left",
                                            isActive
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-transparent border-transparent text-foreground hover:bg-foreground/5",
                                        )}
                                        key={item.type}
                                        onClick={() => handleSelect(item.type)}
                                        type="button"
                                    >
                                        <span
                                            class={clsx(
                                                "shrink-0 size-5 rounded-sm border border-dashed flex items-center justify-center",
                                                isActive ? "border-primary-foreground/40 bg-primary-foreground/10" : "border-border bg-foreground/3 text-muted-foreground/60",
                                            )}
                                        >
                                            <PaletteIcon type={item.type} />
                                        </span>
                                        <span class="flex-1 min-w-0 text-[0.7rem] font-medium truncate">{item.label}</span>
                                        {count > 0 ? (
                                            <span class={clsx("text-[0.55rem] font-mono", isActive ? "text-primary-foreground/70" : "text-muted-foreground/60")}>×{count}</span>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </Section>
                ))}
            </div>

            <div class="border-t border-border shrink-0 px-3 py-2 flex items-center gap-2">
                <select
                    class="bg-foreground/5 border border-border/60 rounded text-[0.65rem] px-1.5 py-1 text-foreground cursor-pointer"
                    onChange={(event_) => setLayoutModeState({ detailLevel: (event_.target as HTMLSelectElement).value as DetailLevel })}
                    value={state.detailLevel}
                >
                    {DETAIL_LEVELS.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.label}
                        </option>
                    ))}
                </select>
                <button
                    class="text-[0.7rem] font-medium px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                    onClick={handleCopyOutput}
                    type="button"
                >
                    {copied ? "Copied!" : "Copy markdown"}
                </button>
                <div class="flex-1" />
                {totalPlacements + totalSections > 0 ? (
                    <button
                        class="text-[0.65rem] text-muted-foreground hover:text-destructive transition-colors cursor-pointer bg-transparent border-0"
                        onClick={handleClear}
                        type="button"
                    >
                        Clear
                    </button>
                ) : null}
            </div>
        </div>
    );
};

const Mounter = ({ children }: { children: JSX.Element }): null => {
    useEffect(() => {
        mountLayoutModeOverlay(children);
    });

    useEffect(() => () => unmountLayoutModeOverlay(), []);

    return null;
};

const LayoutOverlay = (): JSX.Element => {
    const state = useLayoutModeStore();
    const isDark = isDarkTheme();

    return (
        <>
            <DesignMode
                activeComponent={state.activeComponent}
                clearSignal={state.clearSignal}
                deselectSignal={state.deselectSignal}
                isDarkMode={isDark}
                onActiveComponentChange={(t) => setLayoutModeState({ activeComponent: t })}
                onChange={(placements) => setLayoutModeState({ placements })}
                onSelectionChange={() => setLayoutModeState((s) => ({ deselectSignal: s.deselectSignal + 1 }))}
                placements={state.placements}
                wireframe={state.blankCanvas}
            />
            <RearrangeOverlay
                blankCanvas={state.blankCanvas}
                clearSignal={state.clearSignal}
                deselectSignal={state.deselectSignal}
                isDarkMode={isDark}
                onChange={(rearrange) => setLayoutModeState({ rearrange })}
                onSelectionChange={() => setLayoutModeState((s) => ({ deselectSignal: s.deselectSignal + 1 }))}
                rearrangeState={state.rearrange}
            />
        </>
    );
};

const LayoutModeAppWithOverlay = (props: AppComponentProps): ComponentChildren => (
    <>
        <LayoutModeApp {...props} />
        <Mounter>
            <LayoutOverlay />
        </Mounter>
    </>
);

export default LayoutModeAppWithOverlay;
