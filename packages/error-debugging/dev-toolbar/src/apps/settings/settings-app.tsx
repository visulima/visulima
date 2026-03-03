/** @jsxImportSource preact */
import monitorIcon from "lucide-static/icons/monitor.svg?data-uri&encoding=css";
import moonIcon from "lucide-static/icons/moon.svg?data-uri&encoding=css";
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { DEFAULT_KEYBINDINGS, useFrameState } from "../../toolbar/hooks/use-frame-state";
import type { Theme } from "../../toolbar/hooks/use-theme";
import { useTheme } from "../../toolbar/hooks/use-theme";
import type { AppComponentProps } from "../../types/app";
import { Button } from "../../ui";
import Icon from "../../ui/components/icon";
import cn from "../../utils/cn";

// ─── Reusable primitives ─────────────────────────────────────────────────────

/** Single settings row: label + description on left, control on right */
const SettingRow = ({ control, description, label }: { control: ComponentChildren; description?: string; label: string }): ComponentChildren => (
    <div class="flex items-center justify-between gap-6 py-3.5">
        <div class="min-w-0">
            <div class="text-[0.8125rem] font-medium text-foreground leading-none mb-0.5">{label}</div>
            {description && <div class="text-[0.725rem] text-muted-foreground leading-snug mt-1">{description}</div>}
        </div>
        <div class="shrink-0">{control}</div>
    </div>
);

/** Section with title and divider */
const Section = ({ children, title }: { children: ComponentChildren; title: string }): ComponentChildren => (
    <section>
        <h3 class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
            <span aria-hidden="true" class="text-primary/50">
                //
            </span>
            {title}
        </h3>
        <div class="rounded-none border border-border bg-card divide-y divide-border overflow-hidden border-l-2 border-l-primary/20">
            <div class="px-4">{children}</div>
        </div>
    </section>
);

/** Sliding toggle switch */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): ComponentChildren => (
    <button
        aria-checked={checked}
        class={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-none border-2 border-transparent",
            "transition-colors duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked ? "bg-primary" : "bg-foreground/15",
        )}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
    >
        <span
            class={cn(
                "pointer-events-none inline-block h-4 w-4 shadow-sm",
                "transition-all duration-200 ease-in-out",
                // When ON the track is lime (#caff00) — use dark thumb for contrast (17:1)
                // When OFF the track is foreground/15 — use white thumb (high contrast on both modes)
                checked ? "translate-x-4 bg-primary-foreground" : "translate-x-0 bg-white",
            )}
        />
    </button>
);

/** 3-way segmented control for theme */
const ThemeControl = ({ onChange, value }: { onChange: (v: Theme) => void; value: Theme }): ComponentChildren => {
    const options: { icon: ComponentChildren; label: string; value: Theme }[] = [
        {
            icon: <Icon size={13} src={sunIcon} />,
            label: "Light",
            value: "light",
        },
        {
            icon: <Icon size={13} src={moonIcon} />,
            label: "Dark",
            value: "dark",
        },
        {
            icon: <Icon size={13} src={monitorIcon} />,
            label: "System",
            value: "system",
        },
    ];

    return (
        <div class="flex items-center gap-0.5 bg-foreground/6 p-0.5">
            {options.map((opt) => (
                <button
                    aria-pressed={value === opt.value}
                    class={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 text-[0.75rem] font-medium",
                        "transition-all duration-150 cursor-pointer border-0",
                        value === opt.value ? "bg-background text-foreground shadow-sm" : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    type="button"
                >
                    {opt.icon}
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

/** Segmented select for auto-hide delay */
const HIDE_OPTIONS: { label: string; value: number }[] = [
    { label: "Never", value: -1 },
    { label: "Always", value: 0 },
    { label: "2s", value: 2000 },
    { label: "5s", value: 5000 },
    { label: "10s", value: 10_000 },
    { label: "30s", value: 30_000 },
];

const HideDelayControl = ({ onChange, value }: { onChange: (v: number) => void; value: number }): ComponentChildren => (
    <select
        class={cn(
            "bg-foreground/6 border border-border",
            "text-[0.775rem] font-medium text-foreground",
            "px-2.5 py-1.5 cursor-pointer",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            "transition-colors duration-150",
        )}
        onChange={(e) => onChange(Number((e.target as HTMLSelectElement).value))}
        value={String(value)}
    >
        {HIDE_OPTIONS.map((opt) => (
            <option key={opt.value} value={String(opt.value)}>
                {opt.label}
            </option>
        ))}
    </select>
);

// ─── Keyboard shortcut capture ────────────────────────────────────────────────

const formatBinding = (binding: string): string[] => binding.split("+");

const KeyBadge = ({ part }: { part: string }): ComponentChildren => (
    <span class="inline-flex items-center px-1.5 py-0.5 text-[0.65rem] font-mono font-medium bg-foreground/8 border border-border text-foreground">{part}</span>
);

const KeyCapture = ({ onChange, value }: { onChange: (v: string) => void; value: string }): ComponentChildren => {
    const [capturing, setCapturing] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!capturing) {
            return undefined;
        }

        const handleKeyDown = (e: KeyboardEvent): void => {
            e.preventDefault();
            e.stopPropagation();

            // Ignore lone modifier keys
            if (["Alt", "Control", "Meta", "Shift"].includes(e.key)) {
                return;
            }

            const parts: string[] = [];

            if (e.altKey)
                parts.push("Alt");

            if (e.ctrlKey)
                parts.push("Control");

            if (e.metaKey)
                parts.push("Meta");

            if (e.shiftKey)
                parts.push("Shift");

            parts.push(e.key);

            onChange(parts.join("+"));
            setCapturing(false);
        };

        globalThis.addEventListener("keydown", handleKeyDown, true);

        return () => globalThis.removeEventListener("keydown", handleKeyDown, true);
    }, [capturing, onChange]);

    return (
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-0.5">
                {formatBinding(value).map((part, i) => (
                    <span class="flex items-center gap-0.5" key={i}>
                        {i > 0 && <span class="text-muted-foreground/40 text-[0.6rem] mx-0.5">+</span>}
                        <KeyBadge part={part} />
                    </span>
                ))}
            </div>
            <Button
                class={cn("text-[0.7rem]", capturing ? "border-primary text-primary bg-primary/8 animate-pulse" : "")}
                onClick={() => setCapturing((c) => !c)}
                ref={buttonRef}
                size="sm"
                variant="outline"
            >
                {capturing ? "Press keys…" : "Record"}
            </Button>
            <Button
                class="text-[0.7rem]"
                onClick={() => {
                    setCapturing(false);
                }}
                size="sm"
                title="Cancel"
                variant="ghost"
            >
                ✕
            </Button>
        </div>
    );
};

// ─── Settings app ─────────────────────────────────────────────────────────────

const SettingsApp = (_props: AppComponentProps): ComponentChildren => {
    const { state, updateState } = useFrameState();
    const { setTheme, theme } = useTheme();

    return (
        <div class="p-5 space-y-5 max-w-2xl">
            {/* Appearance */}
            <Section title="Appearance">
                <SettingRow control={<ThemeControl onChange={setTheme} value={theme} />} description="Color scheme for the DevTools panel." label="Theme" />
                <SettingRow
                    control={<Toggle checked={state.reduceMotion} onChange={(v) => updateState({ reduceMotion: v })} />}
                    description="Disable animations and transitions throughout the toolbar."
                    label="Reduce motion"
                />
            </Section>

            {/* Toolbar */}
            <Section title="Toolbar">
                <SettingRow
                    control={<HideDelayControl onChange={(v) => updateState({ minimizePanelInactive: v })} value={state.minimizePanelInactive} />}
                    description="Collapse the toolbar pill after a period of inactivity. Set 'Never' to always keep it visible."
                    label="Auto-hide when inactive"
                />
                <SettingRow
                    control={<Toggle checked={state.preferShowFloatingPanel} onChange={(v) => updateState({ preferShowFloatingPanel: v })} />}
                    description="Keep the toolbar pill visible even when the DevTools panel is not open."
                    label="Show toolbar when panel is closed"
                />
            </Section>

            {/* Panel */}
            <Section title="Panel">
                <SettingRow
                    control={<Toggle checked={state.closeOnOutsideClick} onChange={(v) => updateState({ closeOnOutsideClick: v })} />}
                    description="Close the DevTools panel when clicking outside of it."
                    label="Close on outside click"
                />
            </Section>

            {/* Keyboard Shortcuts */}
            <Section title="Keyboard Shortcuts">
                <SettingRow
                    control={
                        <div class="flex items-center gap-2">
                            <KeyCapture
                                onChange={(v) => updateState({ keybindings: { ...state.keybindings ?? DEFAULT_KEYBINDINGS, toggle: v } })}
                                value={state.keybindings?.toggle ?? DEFAULT_KEYBINDINGS.toggle}
                            />
                            {state.keybindings?.toggle !== DEFAULT_KEYBINDINGS.toggle && (
                                <Button
                                    class="h-auto p-0 text-[0.65rem]"
                                    onClick={() =>
                                        updateState({ keybindings: { ...state.keybindings ?? DEFAULT_KEYBINDINGS, toggle: DEFAULT_KEYBINDINGS.toggle } })
                                    }
                                    variant="link"
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    }
                    description="Open or close the DevTools panel."
                    label="Toggle toolbar"
                />
                <SettingRow
                    control={
                        <div class="flex items-center gap-2">
                            <KeyCapture
                                onChange={(v) => updateState({ keybindings: { ...state.keybindings ?? DEFAULT_KEYBINDINGS, close: v } })}
                                value={state.keybindings?.close ?? DEFAULT_KEYBINDINGS.close}
                            />
                            {state.keybindings?.close !== DEFAULT_KEYBINDINGS.close && (
                                <Button
                                    class="h-auto p-0 text-[0.65rem]"
                                    onClick={() =>
                                        updateState({ keybindings: { ...state.keybindings ?? DEFAULT_KEYBINDINGS, close: DEFAULT_KEYBINDINGS.close } })
                                    }
                                    variant="link"
                                >
                                    Reset
                                </Button>
                            )}
                        </div>
                    }
                    description="Dismiss the active app or close the panel."
                    label="Close panel"
                />
            </Section>
        </div>
    );
};

export default SettingsApp;
