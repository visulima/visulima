/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import monitorIcon from "lucide-static/icons/monitor.svg?data-uri&encoding=css";
import moonIcon from "lucide-static/icons/moon.svg?data-uri&encoding=css";
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";

import type { AppComponentProps } from "../../types/app";
import Icon from "../../ui/components/icon";
import cn from "../../utils/cn";
import { DEFAULT_KEYBINDINGS, useFrameState } from "../../toolbar/hooks/use-frame-state";
import { useTheme } from "../../toolbar/hooks/use-theme";
import type { Theme } from "../../toolbar/hooks/use-theme";

// ─── Reusable primitives ─────────────────────────────────────────────────────

/** Single settings row: label + description on left, control on right */
const SettingRow = ({
    label,
    description,
    control,
}: {
    label: string;
    description?: string;
    control: ComponentChildren;
}): ComponentChildren => (
    <div class="flex items-center justify-between gap-6 py-3.5">
        <div class="min-w-0">
            <div class="text-[0.8125rem] font-medium text-foreground leading-none mb-0.5">{label}</div>
            {description && <div class="text-[0.725rem] text-muted-foreground leading-snug mt-1">{description}</div>}
        </div>
        <div class="shrink-0">{control}</div>
    </div>
);

/** Section with title and divider */
const Section = ({ title, children }: { title: string; children: ComponentChildren }): ComponentChildren => (
    <section>
        <h3 class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
        <span aria-hidden="true" class="text-primary/50">//</span>
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
const ThemeControl = ({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }): ComponentChildren => {
    const options: { label: string; value: Theme; icon: ComponentChildren }[] = [
        {
            label: "Light",
            value: "light",
            icon: <Icon size={13} src={sunIcon} />,
        },
        {
            label: "Dark",
            value: "dark",
            icon: <Icon size={13} src={moonIcon} />,
        },
        {
            label: "System",
            value: "system",
            icon: <Icon size={13} src={monitorIcon} />,
        },
    ];

    return (
        <div class="flex items-center gap-0.5 bg-foreground/6 p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    aria-pressed={value === opt.value}
                    class={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 text-[0.75rem] font-medium",
                        "transition-all duration-150 cursor-pointer border-0",
                        value === opt.value
                            ? "bg-background text-foreground shadow-sm"
                            : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
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
    { label: "10s", value: 10000 },
    { label: "30s", value: 30000 },
];

const HideDelayControl = ({ value, onChange }: { value: number; onChange: (v: number) => void }): ComponentChildren => (
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
    <span class="inline-flex items-center px-1.5 py-0.5 text-[0.65rem] font-mono font-medium bg-foreground/8 border border-border text-foreground">
        {part}
    </span>
);

const KeyCapture = ({
    value,
    onChange,
}: {
    value: string;
    onChange: (v: string) => void;
}): ComponentChildren => {
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
            if (["Alt", "Shift", "Control", "Meta"].includes(e.key)) {
                return;
            }

            const parts: string[] = [];

            if (e.altKey) parts.push("Alt");
            if (e.ctrlKey) parts.push("Control");
            if (e.metaKey) parts.push("Meta");
            if (e.shiftKey) parts.push("Shift");
            parts.push(e.key);

            onChange(parts.join("+"));
            setCapturing(false);
        };

        window.addEventListener("keydown", handleKeyDown, true);

        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [capturing, onChange]);

    return (
        <div class="flex items-center gap-2">
            <div class="flex items-center gap-0.5">
                {formatBinding(value).map((part, i) => (
                    <span key={i} class="flex items-center gap-0.5">
                        {i > 0 && <span class="text-muted-foreground/40 text-[0.6rem] mx-0.5">+</span>}
                        <KeyBadge part={part} />
                    </span>
                ))}
            </div>
            <button
                ref={buttonRef}
                class={cn(
                    "px-2 py-0.5 text-[0.7rem] font-medium border cursor-pointer transition-colors",
                    capturing
                        ? "border-primary text-primary bg-primary/8 animate-pulse"
                        : "border-border text-muted-foreground hover:text-foreground bg-transparent",
                )}
                onClick={() => setCapturing((c) => !c)}
                type="button"
            >
                {capturing ? "Press keys…" : "Record"}
            </button>
            <button
                class="px-2 py-0.5 text-[0.7rem] font-medium border border-border/50 text-muted-foreground/60 hover:text-foreground bg-transparent cursor-pointer transition-colors"
                onClick={() => {
                    setCapturing(false);
                }}
                title="Cancel"
                type="button"
            >
                ✕
            </button>
        </div>
    );
};

// ─── Settings app ─────────────────────────────────────────────────────────────

const SettingsApp = (_props: AppComponentProps): ComponentChildren => {
    const { state, updateState } = useFrameState();
    const { theme, setTheme } = useTheme();

    return (
        <div class="p-5 space-y-5 max-w-2xl">
            {/* Appearance */}
            <Section title="Appearance">
                <SettingRow
                    label="Theme"
                    description="Color scheme for the DevTools panel."
                    control={<ThemeControl value={theme} onChange={setTheme} />}
                />
                <SettingRow
                    label="Reduce motion"
                    description="Disable animations and transitions throughout the toolbar."
                    control={<Toggle checked={state.reduceMotion} onChange={(v) => updateState({ reduceMotion: v })} />}
                />
            </Section>

            {/* Toolbar */}
            <Section title="Toolbar">
                <SettingRow
                    label="Auto-hide when inactive"
                    description="Collapse the toolbar pill after a period of inactivity. Set 'Never' to always keep it visible."
                    control={<HideDelayControl value={state.minimizePanelInactive} onChange={(v) => updateState({ minimizePanelInactive: v })} />}
                />
                <SettingRow
                    label="Show toolbar when panel is closed"
                    description="Keep the toolbar pill visible even when the DevTools panel is not open."
                    control={<Toggle checked={state.preferShowFloatingPanel} onChange={(v) => updateState({ preferShowFloatingPanel: v })} />}
                />
            </Section>

            {/* Panel */}
            <Section title="Panel">
                <SettingRow
                    label="Close on outside click"
                    description="Close the DevTools panel when clicking outside of it."
                    control={<Toggle checked={state.closeOnOutsideClick} onChange={(v) => updateState({ closeOnOutsideClick: v })} />}
                />
            </Section>

            {/* Keyboard Shortcuts */}
            <Section title="Keyboard Shortcuts">
                <SettingRow
                    label="Toggle toolbar"
                    description="Open or close the DevTools panel."
                    control={
                        <div class="flex items-center gap-2">
                            <KeyCapture
                                value={state.keybindings?.toggle ?? DEFAULT_KEYBINDINGS.toggle}
                                onChange={(v) => updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), toggle: v } })}
                            />
                            {state.keybindings?.toggle !== DEFAULT_KEYBINDINGS.toggle && (
                                <button
                                    class="text-[0.65rem] text-muted-foreground/50 hover:text-foreground underline cursor-pointer border-0 bg-transparent"
                                    onClick={() => updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), toggle: DEFAULT_KEYBINDINGS.toggle } })}
                                    type="button"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    }
                />
                <SettingRow
                    label="Close panel"
                    description="Dismiss the active app or close the panel."
                    control={
                        <div class="flex items-center gap-2">
                            <KeyCapture
                                value={state.keybindings?.close ?? DEFAULT_KEYBINDINGS.close}
                                onChange={(v) => updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), close: v } })}
                            />
                            {state.keybindings?.close !== DEFAULT_KEYBINDINGS.close && (
                                <button
                                    class="text-[0.65rem] text-muted-foreground/50 hover:text-foreground underline cursor-pointer border-0 bg-transparent"
                                    onClick={() => updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), close: DEFAULT_KEYBINDINGS.close } })}
                                    type="button"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    }
                />
            </Section>
        </div>
    );
};

export default SettingsApp;
