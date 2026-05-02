/** @jsxImportSource preact */

import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import monitorIcon from "lucide-static/icons/monitor.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import moonIcon from "lucide-static/icons/moon.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import sunIcon from "lucide-static/icons/sun.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { DEFAULT_KEYBINDINGS, useFrameState } from "../../toolbar/hooks/use-frame-state";
import type { Theme } from "../../toolbar/hooks/use-theme";
import { useTheme } from "../../toolbar/hooks/use-theme";
import type { AppComponentProps } from "../../types/app";
import { Button } from "../../ui";
import Icon from "../../ui/components/icon";
import type { SelectOption } from "../../ui/components/select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useSelectContext } from "../../ui/components/select";
import type { ClipboardField, ClipboardProfile } from "../inspector/clipboard-config";
import {
    BUILT_IN_PROFILES,
    DETAIL_DEFAULTS,
    isFieldEnabled,
    loadClipboardProfile,
    saveClipboardProfile,
} from "../inspector/clipboard-config";

// ─── Reusable primitives ─────────────────────────────────────────────────────

/** Single settings row with label and description on the left, and control on the right. */
const SettingRow = ({ control, description, label }: { control: ComponentChildren; description?: string; label: string }): ComponentChildren => (
    <div class="flex items-center justify-between gap-6 py-3.5">
        <div class="min-w-0">
            <div class="text-[0.8125rem] font-medium text-foreground leading-none mb-0.5">{label}</div>
            {description && <div class="text-[0.725rem] text-muted-foreground leading-snug mt-1">{description}</div>}
        </div>
        <div class="shrink-0">{control}</div>
    </div>
);

/** Section with a title and divider. */
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

/** Sliding toggle switch component. */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): ComponentChildren => (
    <button
        aria-checked={checked}
        class={clsx(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-none border-2 border-transparent",
            "transition-colors duration-200 ease-in-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            checked ? "bg-primary" : "bg-foreground/15",
        )}
        onClick={() => {
            onChange(!checked);
        }}
        role="switch"
        type="button"
    >
        <span
            class={clsx(
                "pointer-events-none inline-block h-4 w-4 shadow-sm",
                "transition-all duration-200 ease-in-out",
                // When ON the track is lime (#caff00) — use dark thumb for contrast (17:1)
                // When OFF the track is foreground/15 — use white thumb (high contrast on both modes)
                checked ? "translate-x-4 bg-primary-foreground" : "translate-x-0 bg-white",
            )}
        />
    </button>
);

/** Three-way segmented control for theme selection. */
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
                    class={clsx(
                        "flex items-center gap-1.5 px-2.5 py-1.5 text-[0.75rem] font-medium",
                        "transition-all duration-150 cursor-pointer border-0",
                        value === opt.value ? "bg-background text-foreground shadow-sm" : "bg-transparent text-muted-foreground hover:text-foreground",
                    )}
                    key={opt.value}
                    onClick={() => {
                        onChange(opt.value);
                    }}
                    type="button"
                >
                    {opt.icon}
                    {opt.label}
                </button>
            ))}
        </div>
    );
};

/** Select options for auto-hide delay */
const HIDE_OPTIONS: SelectOption[] = [
    { label: "Never", value: "-1" },
    { label: "Always", value: "0" },
    { label: "2s", value: "2000" },
    { label: "5s", value: "5000" },
    { label: "10s", value: "10000" },
    { label: "30s", value: "30000" },
];

const HideDelayControl = ({ onChange, value }: { onChange: (v: number) => void; value: number }): ComponentChildren => (
    <Select
        onValueChange={(v) => {
            onChange(Number(v));
        }}
        value={String(value)}
    >
        <SelectTrigger>
            <SelectValue options={HIDE_OPTIONS} />
        </SelectTrigger>
        <SelectContent>
            {HIDE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
);

// ─── Editor selector ─────────────────────────────────────────────────────────

const EDITOR_OPTIONS: SelectOption[] = [
    { label: "Auto-detected", value: "" },
    { label: "AppCode", value: "appcode" },
    { label: "Android Studio", value: "android-studio" },
    { label: "Atom", value: "atom" },
    { label: "Atom Beta", value: "atom-beta" },
    { label: "Brackets", value: "brackets" },
    { label: "CLion", value: "clion" },
    { label: "Visual Studio Code", value: "code" },
    { label: "Visual Studio Code Insiders", value: "code-insiders" },
    { label: "VSCodium", value: "codium" },
    { label: "Cursor", value: "cursor" },
    { label: "GNU Emacs", value: "emacs" },
    { label: "GNU Emacs for Mac OS X", value: "emacsforosx" },
    { label: "IntelliJ IDEA", value: "intellij" },
    { label: "GNU nano", value: "nano" },
    { label: "NeoVim", value: "neovim" },
    { label: "Notepad++", value: "notepad++" },
    { label: "PhpStorm", value: "phpstorm" },
    { label: "PyCharm", value: "pycharm" },
    { label: "Rider", value: "rider" },
    { label: "RubyMine", value: "rubymine" },
    { label: "SublimeText", value: "sublime" },
    { label: "TextMate", value: "textmate" },
    { label: "Vim", value: "vim" },
    { label: "Visual Studio", value: "visualstudio" },
    { label: "WebStorm", value: "webstorm" },
    { label: "Xcode", value: "xcode" },
    { label: "Zed", value: "zed" },
];

/** Filtered editor list that reads the search context. */
const EditorItems = (): ComponentChildren => {
    const { search } = useSelectContext();
    const query = search.toLowerCase();
    const filtered = query ? EDITOR_OPTIONS.filter((opt) => opt.label.toLowerCase().includes(query)) : EDITOR_OPTIONS;

    if (filtered.length === 0) {
        return <div class="px-2 py-3 text-center text-[0.725rem] text-muted-foreground">No editors found</div>;
    }

    return (
        <>
            {filtered.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                </SelectItem>
            ))}
        </>
    );
};

const EditorControl = ({ onChange, value }: { onChange: (v: string) => void; value: string }): ComponentChildren => (
    <Select onValueChange={onChange} value={value}>
        <SelectTrigger>
            <SelectValue options={EDITOR_OPTIONS} placeholder="Auto-detected" />
        </SelectTrigger>
        <SelectContent searchable>
            <EditorItems />
        </SelectContent>
    </Select>
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

        const handleKeyDown = (event: KeyboardEvent): void => {
            event.preventDefault();
            event.stopPropagation();

            // Ignore lone modifier keys
            if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) {
                return;
            }

            const parts: string[] = [];

            if (event.altKey) {
                parts.push("Alt");
            }

            if (event.ctrlKey) {
                parts.push("Control");
            }

            if (event.metaKey) {
                parts.push("Meta");
            }

            if (event.shiftKey) {
                parts.push("Shift");
            }

            parts.push(event.key);

            onChange(parts.join("+"));
            setCapturing(false);
        };

        globalThis.addEventListener("keydown", handleKeyDown, true);

        return () => {
            globalThis.removeEventListener("keydown", handleKeyDown, true);
        };
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
                class={clsx("text-[0.7rem]", capturing ? "border-primary text-primary bg-primary/8 animate-pulse" : "")}
                onClick={() => {
                    setCapturing((c) => !c);
                }}
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

// ─── Clipboard section ────────────────────────────────────────────────────────

const FIELD_LABELS: { description: string; key: ClipboardField; label: string }[] = [
    { description: "Page URL where the annotation was captured.", key: "url", label: "URL" },
    { description: "Annotation status (open / resolved / ...).", key: "status", label: "Status" },
    { description: "CSS selector that re-finds the element.", key: "selector", label: "Selector" },
    { description: "Source file path from data-vdt-source.", key: "source", label: "Source attribute" },
    { description: "Detected React/Vue/Svelte component name.", key: "frameworkComponent", label: "Component" },
    { description: "Component file:line for direct IDE jumps.", key: "componentSource", label: "Component file" },
    { description: "Full component tree above the element.", key: "componentStack", label: "Component stack" },
    { description: "Text the user had selected when annotating.", key: "selectedText", label: "Selected text" },
    { description: "Cleaned CSS class list on the element.", key: "classes", label: "CSS classes" },
    { description: "Visible text near the element for context.", key: "nearbyText", label: "Nearby text" },
    { description: "Full DOM ancestry path.", key: "domPath", label: "DOM path" },
    { description: "Computed styles on the element.", key: "computedStyles", label: "Computed styles" },
    { description: "Sibling tags around the element.", key: "nearbyElements", label: "Nearby elements" },
    { description: "ARIA role / accessibility metadata.", key: "accessibility", label: "Accessibility" },
];

const profileOptions: SelectOption[] = Object.entries(BUILT_IN_PROFILES).map(([id, p]) => {
    return {
        label: p.name,
        value: id,
    };
});

const ClipboardSection = (): ComponentChildren => {
    const [profile, setProfile] = useState<ClipboardProfile>(loadClipboardProfile);

    const apply = (next: ClipboardProfile): void => {
        setProfile(next);
        saveClipboardProfile(next);
    };

    const onPickProfile = (id: string): void => {
        const p = BUILT_IN_PROFILES[id];

        if (p) {
            apply({ ...p });
        }
    };

    const toggleField = (field: ClipboardField, value: boolean): void => {
        const defaultValue = DETAIL_DEFAULTS[profile.detail].has(field);
        const overrides: Partial<Record<ClipboardField, boolean>> = Object.fromEntries(
            Object.entries(profile.fields ?? {}).filter(([key]) => key !== field),
        ) as Partial<Record<ClipboardField, boolean>>;

        if (value !== defaultValue) {
            overrides[field] = value;
        }

        apply({ ...profile, fields: Object.keys(overrides).length > 0 ? overrides : undefined, name: "Custom" });
    };

    const matchedProfileId = Object.entries(BUILT_IN_PROFILES).find(([, p]) =>
        p.detail === profile.detail
        && JSON.stringify(p.fields ?? {}) === JSON.stringify(profile.fields ?? {}))?.[0] ?? "custom";

    return (
        <Section title="Clipboard">
            <SettingRow
                control={
                    <Select onValueChange={onPickProfile} value={matchedProfileId === "custom" ? "" : matchedProfileId}>
                        <SelectTrigger class="w-44">
                            <SelectValue options={profileOptions} placeholder={matchedProfileId === "custom" ? "Custom" : "Pick a profile"} />
                        </SelectTrigger>
                        <SelectContent>
                            {profileOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
                description="Preset that controls which fields are included when copying annotations or inspector output to the clipboard."
                label="Format profile"
            />
            {FIELD_LABELS.map(({ description, key, label }) => (
                <SettingRow
                    control={
                        <Toggle
                            checked={isFieldEnabled(profile, key)}
                            onChange={(v) => {
                                toggleField(key, v);
                            }}
                        />
                    }
                    description={description}
                    key={key}
                    label={label}
                />
            ))}
        </Section>
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
                    control={
                        <Toggle
                            checked={state.reduceMotion}
                            onChange={(v) => {
                                updateState({ reduceMotion: v });
                            }}
                        />
                    }
                    description="Disable animations and transitions throughout the toolbar."
                    label="Reduce motion"
                />
            </Section>

            {/* Toolbar */}
            <Section title="Toolbar">
                <SettingRow
                    control={
                        <HideDelayControl
                            onChange={(v) => {
                                updateState({ minimizePanelInactive: v });
                            }}
                            value={state.minimizePanelInactive}
                        />
                    }
                    description="Collapse the toolbar pill after a period of inactivity. Set 'Never' to always keep it visible."
                    label="Auto-hide when inactive"
                />
                <SettingRow
                    control={
                        <Toggle
                            checked={state.preferShowFloatingPanel}
                            onChange={(v) => {
                                updateState({ preferShowFloatingPanel: v });
                            }}
                        />
                    }
                    description="Keep the toolbar pill visible even when the DevTools panel is not open."
                    label="Show toolbar when panel is closed"
                />
            </Section>

            {/* Panel */}
            <Section title="Panel">
                <SettingRow
                    control={
                        <Toggle
                            checked={state.closeOnOutsideClick}
                            onChange={(v) => {
                                updateState({ closeOnOutsideClick: v });
                            }}
                        />
                    }
                    description="Close the DevTools panel when clicking outside of it."
                    label="Close on outside click"
                />
            </Section>

            {/* Editor */}
            <Section title="Editor">
                <SettingRow
                    control={
                        <EditorControl
                            onChange={(v) => {
                                updateState({ editor: v });
                            }}
                            value={state.editor}
                        />
                    }
                    description="Editor to open when clicking 'Open in editor'. Select Auto-detected to use the running IDE or EDITOR environment variable."
                    label="Preferred editor"
                />
            </Section>

            {/* Clipboard format */}
            <ClipboardSection />

            {/* Keyboard Shortcuts */}
            <Section title="Keyboard Shortcuts">
                <SettingRow
                    control={
                        <div class="flex items-center gap-2">
                            <KeyCapture
                                onChange={(v) => {
                                    updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), toggle: v } });
                                }}
                                value={state.keybindings?.toggle ?? DEFAULT_KEYBINDINGS.toggle}
                            />
                            {state.keybindings?.toggle !== DEFAULT_KEYBINDINGS.toggle && (
                                <Button
                                    class="h-auto p-0 text-[0.65rem]"
                                    onClick={() => {
                                        updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), toggle: DEFAULT_KEYBINDINGS.toggle } });
                                    }}
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
                                onChange={(v) => {
                                    updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), close: v } });
                                }}
                                value={state.keybindings?.close ?? DEFAULT_KEYBINDINGS.close}
                            />
                            {state.keybindings?.close !== DEFAULT_KEYBINDINGS.close && (
                                <Button
                                    class="h-auto p-0 text-[0.65rem]"
                                    onClick={() => {
                                        updateState({ keybindings: { ...(state.keybindings ?? DEFAULT_KEYBINDINGS), close: DEFAULT_KEYBINDINGS.close } });
                                    }}
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
