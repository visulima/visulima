/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import type { AppComponentProps } from "../../types/app";
import cn from "../../utils/cn";
import { useFrameState } from "../../toolbar/hooks/use-frame-state";
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
        <h3 class="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground mb-1 px-1">{title}</h3>
        <div class="rounded-lg border border-border bg-card divide-y divide-border overflow-hidden">
            <div class="px-4">{children}</div>
        </div>
    </section>
);

/** Sliding toggle switch */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): ComponentChildren => (
    <button
        aria-checked={checked}
        class={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
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
                "pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm",
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
            icon: (
                <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
                    <circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.5" />
                    <path
                        d="M7 1v1M7 12v1M1 7h1M12 7h1M2.93 2.93l.7.7M10.37 10.37l.7.7M10.37 3.63l-.7.7M3.63 10.37l-.7.7"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-width="1.5"
                    />
                </svg>
            ),
        },
        {
            label: "Dark",
            value: "dark",
            icon: (
                <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
                    <path
                        d="M12 8.3A5.5 5.5 0 0 1 5.7 2a5.5 5.5 0 1 0 6.3 6.3Z"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="1.5"
                    />
                </svg>
            ),
        },
        {
            label: "System",
            value: "system",
            icon: (
                <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
                    <rect height="9" rx="1.5" stroke="currentColor" stroke-width="1.5" width="12" x="1" y="2" />
                    <path d="M5 11h4M7 11v2" stroke="currentColor" stroke-linecap="round" stroke-width="1.5" />
                </svg>
            ),
        },
    ];

    return (
        <div class="flex items-center gap-0.5 bg-foreground/[0.06] rounded-lg p-0.5">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    aria-pressed={value === opt.value}
                    class={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[0.75rem] font-medium",
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
            "bg-foreground/[0.06] border border-border rounded-md",
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
        </div>
    );
};

export default SettingsApp;
