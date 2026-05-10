import { Box } from "@visulima/tui/components/box";
import { Dialog } from "@visulima/tui/components/dialog";
import type { ScrollViewRef } from "@visulima/tui/components/scroll-view";
import { Tab } from "@visulima/tui/components/tab";
import { Tabs } from "@visulima/tui/components/tabs";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { useWindowSize } from "@visulima/tui/hooks/use-window-size";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import QuitDialog from "../quit-dialog";
import { filterExtensions, filterFeatures } from "./catalogs/filters";
import { TEMPLATES } from "./catalogs/templates";
import type { DevcontainerStore } from "./devcontainer-store";
import DockerComposeSection, { COMPOSE_FIELD_COUNT } from "./sections/docker-compose-section";
import EnvironmentSection, { getEnvFieldCount } from "./sections/environment-section";
import ExtensionsSection from "./sections/extensions-section";
import FeaturesSection from "./sections/features-section";
import GeneralSection, { GENERAL_BOOLEAN_FIELDS, GENERAL_FIELD_COUNT } from "./sections/general-section";
import LifecycleSection, { LIFECYCLE_FIELD_COUNT } from "./sections/lifecycle-section";
import MountsSection from "./sections/mounts-section";
import PortsSection from "./sections/ports-section";
import PreviewPanel from "./sections/preview-panel";
import type { DevcontainerConfig, SectionId } from "./types";
import { validateConfig } from "./validate";

// ── Layout constants ────────────────────────────────────────────────────

const MIN_VIEWPORT_WIDTH = 80;
const MIN_VIEWPORT_HEIGHT = 15;
const MIN_SPLIT_WIDTH = 120;

// Tabs without the "preview" section (it's always visible as a side panel)
const EDITOR_SECTIONS: ReadonlyArray<{ description: string; id: SectionId; label: string }> = [
    { description: "Container name, base image, workspace folder, and user", id: "general", label: "General" },
    { description: "Installable tools and runtimes (Node, Python, Docker, etc.)", id: "features", label: "Features" },
    { description: "Ports to forward from the container to your host", id: "ports", label: "Ports" },
    { description: "Commands to run at different stages of the container lifecycle", id: "lifecycle", label: "Lifecycle" },
    { description: "VS Code extensions to auto-install in the container", id: "extensions", label: "Extensions" },
    { description: "Environment variables for the container and IDE", id: "environment", label: "Env" },
    { description: "Volume and bind mounts for persistent data and caches", id: "mounts", label: "Mounts" },
    { description: "Docker Compose integration for multi-container setups", id: "compose", label: "Compose" },
] as const;

const SECTION_DESCRIPTIONS: ReadonlyMap<SectionId, string> = new Map(EDITOR_SECTIONS.map((s) => [s.id, s.description]));

// ── Field count helper ──────────────────────────────────────────────────

const getFieldCount = (section: SectionId, config: DevcontainerConfig, featureSearch: string, extensionSearch: string): number => {
    switch (section) {
        case "compose": {
            return COMPOSE_FIELD_COUNT;
        }

        case "environment": {
            return getEnvFieldCount(config);
        }

        case "extensions": {
            return filterExtensions(extensionSearch).length;
        }

        case "features": {
            return filterFeatures(featureSearch).length;
        }

        case "general": {
            return GENERAL_FIELD_COUNT;
        }

        case "lifecycle": {
            return LIFECYCLE_FIELD_COUNT;
        }

        case "mounts": {
            return (config.mounts?.length ?? 0) + 1;
        }

        case "ports": {
            return (config.forwardPorts?.length ?? 0) + 1;
        }

        default: {
            return 0;
        }
    }
};

// ── Component ───────────────────────────────────────────────────────────

interface VisDevcontainerAppProps {
    readonly onSave: (config: DevcontainerConfig) => void;
    readonly store: DevcontainerStore;
}

const VisDevcontainerApp = ({ onSave, store }: VisDevcontainerAppProps): React.JSX.Element => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- useSyncExternalStore requires the store's subscribe/getSnapshot to be passed by reference
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    const [helpVisible, setHelpVisible] = useState(false);
    const [quitDialogVisible, setQuitDialogVisible] = useState(false);
    const [searchActive, setSearchActive] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [focusedPanel, setFocusedPanel] = useState<"editor" | "preview">("editor");
    const [listScrollOffset, setListScrollOffset] = useState(0);

    // Port input: accumulate locally, submit on Enter
    const [addingPort, setAddingPort] = useState(false);
    const [addPortValue, setAddPortValue] = useState("");

    // Env add mode
    const [addingEnv, setAddingEnv] = useState<"container" | "remote" | null>(null);
    const [addEnvKey, setAddEnvKey] = useState("");
    const [addEnvValue, setAddEnvValue] = useState("");
    const [addEnvPhase, setAddEnvPhase] = useState<"key" | "value">("key");

    // Mount add mode
    const [addingMount, setAddingMount] = useState(false);
    const [mountSource, setMountSource] = useState("");
    const [mountTarget, setMountTarget] = useState("");
    const [mountType, setMountType] = useState<"bind" | "tmpfs" | "volume">("volume");
    const [mountPhase, setMountPhase] = useState<"source" | "target" | "type">("source");

    const helpScrollRef = useRef<ScrollViewRef>(null);
    const previewScrollRef = useRef<ScrollViewRef>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    // Cleanup on unmount
    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    const fieldCount = getFieldCount(state.section, state.config, state.featureSearch, state.extensionSearch);

    // Viewport height for scrollable lists:
    // total rows - VIS header(1) - tabs(1) - description+margin(2) - editor border(2) - section header(1) - footer(2) = 9
    const listViewportHeight = Math.max(1, rows - 9);

    // Keep selected item in view (scroll-follow).
    // `listScrollOffset` is not pure-derived state: the next offset
    // depends on the **previous** offset plus the current field index
    // (sticky-in-view scrolling). useMemo during render can't express
    // this because it has no access to the prior value, and the
    // interaction is cheap enough that a ref-based trick isn't worth
    // the readability cost.
    useEffect(() => {
        if (state.section !== "features" && state.section !== "extensions") {
            return;
        }

        // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state -- prev-value-dependent scroll tracking
        setListScrollOffset((current) => {
            // Scroll down if selected is below viewport
            if (state.fieldIndex >= current + listViewportHeight) {
                return state.fieldIndex - listViewportHeight + 1;
            }

            // Scroll up if selected is above viewport
            if (state.fieldIndex < current) {
                return state.fieldIndex;
            }

            return current;
        });
    }, [state.fieldIndex, state.section, listViewportHeight]);

    // Reset scroll offset when switching sections or changing search
    useEffect(() => {
        setListScrollOffset(0);
    }, [state.section, state.featureSearch, state.extensionSearch]);

    const handleSave = useCallback(() => {
        const cleanConfig = store.cleanConfig();
        const validation = validateConfig(cleanConfig);

        if (!validation.valid) {
            const firstError = validation.errors[0];

            setSaveMessage(firstError ? `Error: ${firstError.message}` : "Validation failed");

            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            saveTimerRef.current = setTimeout(() => {
                if (mountedRef.current) {
                    setSaveMessage(null);
                }
            }, 3000);

            return;
        }

        onSave(cleanConfig);
        store.markClean();

        const warningCount = validation.warnings.length;

        setSaveMessage(warningCount > 0 ? `Saved! (${String(warningCount)} warning${warningCount > 1 ? "s" : ""})` : "Saved!");

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            if (mountedRef.current) {
                setSaveMessage(null);
            }
        }, 2000);
    }, [onSave, store]);

    // ── Template selector ───────────────────────────────────────────

    useInput(
        (input, key) => {
            if (key.downArrow || input === "j") {
                store.setTemplateIndex(state.templateIndex + 1);
            } else if (key.upArrow || input === "k") {
                store.setTemplateIndex(state.templateIndex - 1);
            } else if (key.return) {
                const template = TEMPLATES[state.templateIndex];

                if (template) {
                    store.applyTemplate(template.id);
                }
            } else if (key.escape) {
                store.dismissTemplateSelector();
            }
        },
        { isActive: state.showTemplateSelector },
    );

    // ── Port input handler ──────────────────────────────────────────

    useInput(
        (input, key) => {
            if (key.escape) {
                setAddingPort(false);
                setAddPortValue("");

                return;
            }

            if (key.return) {
                const parsed = Number.parseInt(addPortValue, 10);

                if (!Number.isNaN(parsed) && parsed > 0 && parsed <= 65_535) {
                    store.addPort(parsed);
                }

                setAddingPort(false);
                setAddPortValue("");

                return;
            }

            if (key.backspace) {
                setAddPortValue((v) => v.slice(0, -1));

                return;
            }

            if (input && /^\d$/u.test(input)) {
                setAddPortValue((v) => v + input);
            }
        },
        { isActive: addingPort },
    );

    // ── Env add handler ─────────────────────────────────────────────

    useInput(
        (input, key) => {
            if (key.escape) {
                setAddingEnv(null);
                setAddEnvKey("");
                setAddEnvValue("");
                setAddEnvPhase("key");

                return;
            }

            if (key.return) {
                if (addEnvPhase === "key" && addEnvKey) {
                    setAddEnvPhase("value");

                    return;
                }

                if (addEnvPhase === "value" && addEnvKey) {
                    store.addEnvVar(addingEnv as "container" | "remote", addEnvKey, addEnvValue);
                    setAddingEnv(null);
                    setAddEnvKey("");
                    setAddEnvValue("");
                    setAddEnvPhase("key");

                    return;
                }
            }

            if (key.backspace) {
                if (addEnvPhase === "key") {
                    setAddEnvKey((v) => v.slice(0, -1));
                } else {
                    setAddEnvValue((v) => v.slice(0, -1));
                }

                return;
            }

            if (input && !key.ctrl && !key.meta) {
                if (addEnvPhase === "key") {
                    setAddEnvKey((v) => v + input);
                } else {
                    setAddEnvValue((v) => v + input);
                }
            }
        },
        { isActive: addingEnv !== null },
    );

    // ── Mount add handler ────────────────────────────────────────────

    useInput(
        (input, key) => {
            if (key.escape) {
                setAddingMount(false);
                setMountSource("");
                setMountTarget("");
                setMountPhase("source");

                return;
            }

            if (key.return) {
                if (mountPhase === "source" && mountSource) {
                    setMountPhase("target");

                    return;
                }

                if (mountPhase === "target" && mountTarget) {
                    setMountPhase("type");

                    return;
                }

                if (mountPhase === "type") {
                    store.addMount({ source: mountSource, target: mountTarget, type: mountType });
                    setAddingMount(false);
                    setMountSource("");
                    setMountTarget("");
                    setMountPhase("source");

                    return;
                }
            }

            // In type phase, use 1/2/3 to pick type
            if (mountPhase === "type") {
                switch (input) {
                    case "1": {
                        setMountType("volume");

                        break;
                    }
                    case "2": {
                        setMountType("bind");

                        break;
                    }
                    case "3": {
                        setMountType("tmpfs");

                        break;
                    }
                    default: {
                        break;
                    }
                }

                return;
            }

            if (key.backspace) {
                if (mountPhase === "source") {
                    setMountSource((v) => v.slice(0, -1));
                } else if (mountPhase === "target") {
                    setMountTarget((v) => v.slice(0, -1));
                }

                return;
            }

            if (input && !key.ctrl && !key.meta) {
                if (mountPhase === "source") {
                    setMountSource((v) => v + input);
                } else if (mountPhase === "target") {
                    setMountTarget((v) => v + input);
                }
            }
        },
        { isActive: addingMount },
    );

    // ── Main keyboard handler ───────────────────────────────────────

    useInput(
        (input, key) => {
            // Ctrl+C: always exit
            if (input === "c" && key.ctrl) {
                exit();

                return;
            }

            if (quitDialogVisible) {
                return;
            }

            if (helpVisible) {
                if (key.escape || input === "?") {
                    setHelpVisible(false);
                } else if (key.downArrow || input === "j") {
                    helpScrollRef.current?.scrollBy(1);
                } else if (key.upArrow || input === "k") {
                    helpScrollRef.current?.scrollBy(-1);
                } else if (input === "q") {
                    setHelpVisible(false);
                    setQuitDialogVisible(true);
                }

                return;
            }

            // Search mode for features/extensions
            if (searchActive) {
                if (key.escape) {
                    setSearchActive(false);

                    if (state.section === "features") {
                        store.setFeatureSearch("");
                    } else {
                        store.setExtensionSearch("");
                    }

                    return;
                }

                if (key.return) {
                    setSearchActive(false);

                    return;
                }

                if (key.backspace) {
                    if (state.section === "features") {
                        store.setFeatureSearch(state.featureSearch.slice(0, -1));
                    } else {
                        store.setExtensionSearch(state.extensionSearch.slice(0, -1));
                    }

                    return;
                }

                if (input && !key.ctrl && !key.meta) {
                    if (state.section === "features") {
                        store.setFeatureSearch(state.featureSearch + input);
                    } else {
                        store.setExtensionSearch(state.extensionSearch + input);
                    }

                    return;
                }

                return;
            }

            // Text editing mode
            if (state.fieldEditing) {
                if (key.escape) {
                    store.setFieldEditing(false);

                    return;
                }

                if (key.return) {
                    store.setFieldEditing(false);

                    return;
                }

                return;
            }

            // Global shortcuts
            if (input === "?") {
                setHelpVisible(true);

                return;
            }

            if (input === "q") {
                if (state.isDirty) {
                    setQuitDialogVisible(true);
                } else {
                    exit();
                }

                return;
            }

            if (input === "s") {
                handleSave();

                return;
            }

            // Tab to switch focus between editor and preview panels
            if (key.tab) {
                setFocusedPanel((p) => (p === "editor" ? "preview" : "editor"));

                return;
            }

            // Preview panel scrolling
            if (focusedPanel === "preview") {
                if (key.downArrow || input === "j") {
                    previewScrollRef.current?.scrollBy(1);

                    return;
                }

                if (key.upArrow || input === "k") {
                    previewScrollRef.current?.scrollBy(-1);

                    return;
                }

                if (key.pageDown) {
                    previewScrollRef.current?.scrollBy(10);

                    return;
                }

                if (key.pageUp) {
                    previewScrollRef.current?.scrollBy(-10);

                    return;
                }

                if (key.home) {
                    previewScrollRef.current?.scrollToTop();

                    return;
                }

                if (key.end) {
                    previewScrollRef.current?.scrollToBottom();

                    return;
                }

                // Escape goes back to editor
                if (key.escape) {
                    setFocusedPanel("editor");
                }

                return;
            }

            // Editor panel: field navigation (up/down)
            if (key.downArrow || input === "j") {
                if (fieldCount > 0) {
                    store.setFieldIndex(Math.min(state.fieldIndex + 1, fieldCount - 1));
                }

                return;
            }

            if (key.upArrow || input === "k") {
                store.setFieldIndex(Math.max(state.fieldIndex - 1, 0));

                return;
            }

            // Enter to edit field or start add flow
            if (key.return) {
                switch (state.section) {
                    case "compose":
                    case "general":
                    case "lifecycle": {
                        store.setFieldEditing(true);

                        break;
                    }
                    case "environment": {
                        // Enter on "+" add rows triggers add flow
                        const containerCount = Object.keys(state.config.containerEnv ?? {}).length;
                        const containerAddIndex = containerCount;
                        const remoteAddIndex = containerCount + 1 + Object.keys(state.config.remoteEnv ?? {}).length;

                        if (state.fieldIndex === containerAddIndex) {
                            setAddingEnv("container");
                            setAddEnvKey("");
                            setAddEnvValue("");
                            setAddEnvPhase("key");
                        } else if (state.fieldIndex === remoteAddIndex) {
                            setAddingEnv("remote");
                            setAddEnvKey("");
                            setAddEnvValue("");
                            setAddEnvPhase("key");
                        }

                        break;
                    }
                    case "mounts": {
                        const mounts = state.config.mounts ?? [];

                        if (state.fieldIndex === mounts.length) {
                            setAddingMount(true);
                            setMountSource("");
                            setMountTarget("");
                            setMountType("volume");
                            setMountPhase("source");
                        }

                        break;
                    }
                    case "ports": {
                        const ports = state.config.forwardPorts ?? [];

                        if (state.fieldIndex === ports.length) {
                            setAddingPort(true);
                            setAddPortValue("");
                        }

                        break;
                    }
                    default: {
                        break;
                    }
                }

                return;
            }

            // Space to toggle (features, extensions, general booleans)
            if (input === " ") {
                switch (state.section) {
                    case "extensions": {
                        const catalog = filterExtensions(state.extensionSearch);
                        const ext = catalog[state.fieldIndex];

                        if (ext) {
                            store.toggleExtension(ext.id);
                        }

                        break;
                    }
                    case "features": {
                        const catalog = filterFeatures(state.featureSearch);
                        const feature = catalog[state.fieldIndex];

                        if (feature) {
                            store.toggleFeature(feature.id);
                        }

                        break;
                    }
                    case "general": {
                        // Boolean fields start after string fields
                        const stringFieldCount = GENERAL_FIELD_COUNT - GENERAL_BOOLEAN_FIELDS.length;
                        const boolIndex = state.fieldIndex - stringFieldCount;

                        if (boolIndex >= 0 && boolIndex < GENERAL_BOOLEAN_FIELDS.length) {
                            const field = GENERAL_BOOLEAN_FIELDS[boolIndex] as keyof DevcontainerConfig;

                            store.updateConfig({ [field]: !state.config[field] });
                        }

                        break;
                    }
                    default: {
                        break;
                    }
                }

                return;
            }

            // Search in features/extensions
            if (input === "/") {
                if (state.section === "features" || state.section === "extensions") {
                    setSearchActive(true);
                }

                return;
            }

            // "A" (uppercase) - apply all suggested mounts
            if (input === "A" && state.section === "mounts") {
                store.applySuggestedMounts();

                return;
            }

            // "a" key - add entry (env, mounts)
            if (input === "a") {
                if (state.section === "environment") {
                    const containerCount = Object.keys(state.config.containerEnv ?? {}).length;
                    const target = state.fieldIndex <= containerCount ? "container" : "remote";

                    setAddingEnv(target);
                    setAddEnvKey("");
                    setAddEnvValue("");
                    setAddEnvPhase("key");
                } else if (state.section === "mounts") {
                    setAddingMount(true);
                    setMountSource("");
                    setMountTarget("");
                    setMountType("volume");
                    setMountPhase("source");
                }

                return;
            }

            // Delete item
            if (input === "d") {
                switch (state.section) {
                    case "environment": {
                        const containerKeys = Object.keys(state.config.containerEnv ?? {});
                        const remoteKeys = Object.keys(state.config.remoteEnv ?? {});

                        if (state.fieldIndex < containerKeys.length) {
                            store.removeEnvVar("container", containerKeys[state.fieldIndex] as string);

                            // Clamp fieldIndex
                            if (containerKeys.length === 1) {
                                // Deleted last container entry, stay at the add row
                            } else if (state.fieldIndex >= containerKeys.length - 1) {
                                store.setFieldIndex(containerKeys.length - 2);
                            }
                        } else {
                            const remoteIndex = state.fieldIndex - containerKeys.length - 1;

                            if (remoteIndex >= 0 && remoteIndex < remoteKeys.length) {
                                store.removeEnvVar("remote", remoteKeys[remoteIndex] as string);

                                if (remoteKeys.length === 1) {
                                    // Deleted last remote entry, stay at remote add row
                                } else if (remoteIndex >= remoteKeys.length - 1) {
                                    store.setFieldIndex(state.fieldIndex - 1);
                                }
                            }
                        }

                        break;
                    }
                    case "mounts": {
                        const mounts = state.config.mounts ?? [];

                        if (state.fieldIndex < mounts.length) {
                            store.removeMount(state.fieldIndex);

                            const newCount = mounts.length - 1;

                            if (state.fieldIndex >= newCount && newCount > 0) {
                                store.setFieldIndex(newCount - 1);
                            }
                        }

                        break;
                    }
                    case "ports": {
                        const ports = state.config.forwardPorts ?? [];

                        if (state.fieldIndex < ports.length) {
                            store.removePort(state.fieldIndex);

                            const newCount = ports.length - 1;

                            if (state.fieldIndex >= newCount && newCount > 0) {
                                store.setFieldIndex(newCount - 1);
                            }
                        }

                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        },
        { isActive: !state.showTemplateSelector && !addingPort && addingEnv === null && !addingMount },
    );

    // ── Hooks must run before any conditional early-return ─────────
    // `useMemo` for the JSON preview must precede the size-check / template-
    // selector guards below, otherwise React's rules-of-hooks fires because
    // the hook call order varies across renders.
    const jsonPreview = useMemo(() => store.getJsonPreview(), [state.config]);

    // ── Size check ──────────────────────────────────────────────────

    if (columns < MIN_VIEWPORT_WIDTH || rows < MIN_VIEWPORT_HEIGHT) {
        return (
            <Box alignItems="center" height={rows} justifyContent="center" width={columns}>
                <Text color="yellow">
                    Terminal too small (
{columns}
x
{rows}
                    ), need
{" "}
{MIN_VIEWPORT_WIDTH}
x
{MIN_VIEWPORT_HEIGHT}
                </Text>
            </Box>
        );
    }

    // ── Template selector dialog ────────────────────────────────────

    if (state.showTemplateSelector) {
        return (
            <Box alignItems="center" flexDirection="column" height={rows} justifyContent="center" width={columns}>
                <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1} width={60}>
                    <Box justifyContent="center" marginBottom={1}>
                        <Text bold color="cyan">
                            Select a Template
                        </Text>
                    </Box>
                    {TEMPLATES.map((template, index) => {
                        const isSelected = index === state.templateIndex;

                        return (
                            <Box key={template.id}>
                                <Text color={isSelected ? "cyan" : undefined} inverse={isSelected}>
                                    {isSelected ? " \u276F " : "   "}
                                    <Text bold={isSelected}>{template.name}</Text>
                                    <Text dimColor>
{" "}
-
{template.description}
                                    </Text>
                                </Text>
                            </Box>
                        );
                    })}
                    <Box justifyContent="center" marginTop={1}>
                        <Text dimColor>
                            <Text bold color="white">
                                {"\u2191\u2193"}
                            </Text>
{" "}
                            navigate
                            {"  "}
                            <Text bold color="white">
                                Enter
                            </Text>
{" "}
                            select
                            {"  "}
                            <Text bold color="white">
                                Esc
                            </Text>
{" "}
                            blank
                        </Text>
                    </Box>
                </Box>
            </Box>
        );
    }

    // ── Active section content ──────────────────────────────────────

    let sectionContent: React.JSX.Element;

    switch (state.section) {
        case "compose": {
            sectionContent = (
                <DockerComposeSection
                    config={state.config}
                    fieldEditing={state.fieldEditing}
                    fieldIndex={state.fieldIndex}
                    onUpdate={(partial) => {
                        store.updateConfig(partial);
                    }}
                />
            );
            break;
        }

        case "environment": {
            sectionContent = (
                <Box flexDirection="column">
                    <EnvironmentSection config={state.config} fieldIndex={state.fieldIndex} />
                    {addingEnv !== null && (
                        <Box marginTop={1} paddingX={1}>
                            <Text color="cyan">
                                Add
{" "}
{addingEnv}
{" "}
env:
{" "}
                                {addEnvPhase === "key"
                                    ? (
                                    <Text>
                                        key=
                                        <Text color="yellow">{addEnvKey || "_"}</Text>
{" "}
(Enter to set value)
                                    </Text>
                                    )
                                    : (
                                    <Text>
                                        {addEnvKey}
=
<Text color="yellow">{addEnvValue || "_"}</Text>
{" "}
(Enter to confirm, Esc to cancel)
                                    </Text>
                                    )}
                            </Text>
                        </Box>
                    )}
                </Box>
            );
            break;
        }

        case "extensions": {
            sectionContent = (
                <ExtensionsSection
                    config={state.config}
                    fieldIndex={state.fieldIndex}
                    scrollOffset={listScrollOffset}
                    searchText={state.extensionSearch}
                    viewportHeight={listViewportHeight}
                />
            );
            break;
        }

        case "features": {
            sectionContent = (
                <FeaturesSection
                    config={state.config}
                    fieldIndex={state.fieldIndex}
                    scrollOffset={listScrollOffset}
                    searchText={state.featureSearch}
                    viewportHeight={listViewportHeight}
                />
            );
            break;
        }

        case "general": {
            sectionContent = (
                <GeneralSection
                    config={state.config}
                    fieldEditing={state.fieldEditing}
                    fieldIndex={state.fieldIndex}
                    onUpdate={(partial) => {
                        store.updateConfig(partial);
                    }}
                />
            );
            break;
        }

        case "lifecycle": {
            sectionContent = (
                <LifecycleSection
                    config={state.config}
                    fieldEditing={state.fieldEditing}
                    fieldIndex={state.fieldIndex}
                    onSetCommand={(hook, command) => {
                        store.setLifecycleCommand(hook, command);
                    }}
                />
            );
            break;
        }

        case "mounts": {
            sectionContent = (
                <MountsSection
                    addingMount={addingMount}
                    config={state.config}
                    detectedPm={state.detectedPm}
                    fieldIndex={state.fieldIndex}
                    mountPhase={mountPhase}
                    mountSource={mountSource}
                    mountTarget={mountTarget}
                    mountType={mountType}
                    suggestedMounts={state.suggestedMounts}
                />
            );
            break;
        }

        case "ports": {
            sectionContent = <PortsSection addingPort={addingPort} addPortValue={addPortValue} config={state.config} fieldIndex={state.fieldIndex} />;
            break;
        }

        default: {
            sectionContent = <Text>Unknown section</Text>;
        }
    }

    // ── Footer ──────────────────────────────────────────────────────

    const footer = (
        <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" flexShrink={0}>
            <Box flexGrow={1} flexWrap="wrap" gap={2} paddingX={1}>
                <Box gap={1}>
                    <Text bold color="white">
                        q
                    </Text>
                    <Text dimColor>QUIT</Text>
                </Box>
                <Box gap={1}>
                    <Text bold color="white">
                        ?
                    </Text>
                    <Text dimColor>HELP</Text>
                </Box>
                <Box gap={1}>
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
                    <Text dimColor>NAV</Text>
                </Box>
                {(state.section === "features" || state.section === "extensions") && (
                    <Box gap={1}>
                        <Text bold color="white">
                            Space
                        </Text>
                        <Text dimColor>CHECK</Text>
                    </Box>
                )}
                <Box gap={1}>
                    <Text bold color="white">
                        {"\u2190\u2192"}
                    </Text>
                    <Text dimColor>TABS</Text>
                </Box>
                <Box gap={1}>
                    <Text bold color="white">
                        Tab
                    </Text>
                    <Text dimColor>PANEL</Text>
                </Box>
                {(state.section === "features" || state.section === "extensions") && (
                    <Box gap={1}>
                        <Text bold color="white">
                            /
                        </Text>
                        <Text dimColor>FILTER</Text>
                    </Box>
                )}
                <Box gap={1}>
                    <Text bold color="white">
                        s
                    </Text>
                    <Text dimColor>SAVE</Text>
                </Box>
            </Box>
            <Box paddingX={1}>
                {saveMessage && (
<Text color={saveMessage.startsWith("Error") ? "red" : "green"}>
{saveMessage}
{" "}
</Text>
                )}
                {state.isDirty && <Text color="yellow">[modified]</Text>}
                {!state.isDirty && !saveMessage && <Text dimColor>[saved]</Text>}
            </Box>
        </Box>
    );

    // ── Help dialog ─────────────────────────────────────────────────

    const helpPopup = (
        <Dialog
            footer={(
                <Text dimColor>
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
{" "}
                    scroll
{" "}
                    <Text bold color="white">
                        ?
                    </Text>
                    /
                    <Text bold color="white">
                        Esc
                    </Text>
{" "}
                    close
                </Text>
              )}
            scrollRef={helpScrollRef}
            title="KEYBOARD SHORTCUTS"
            visible={helpVisible}
            width={56}
        >
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        NAVIGATION
                    </Text>
                </Box>
                <Text>
                    {" "}
                    <Text bold color="white">
                        {"\u2190\u2192"}
                    </Text>
                    <Text dimColor> Switch tabs</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        {"\u2191\u2193"}
                    </Text>
                    /
                    <Text bold color="white">
                        j/k
                    </Text>
                    <Text dimColor> Navigate within section</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        Tab
                    </Text>
                    <Text dimColor> Switch editor/preview panel</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        Enter
                    </Text>
                    <Text dimColor> Edit selected field</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        Esc
                    </Text>
                    <Text dimColor> Stop editing / cancel</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        FEATURES / EXTENSIONS
                    </Text>
                </Box>
                <Text>
                    {" "}
                    <Text bold color="white">
                        Space
                    </Text>
                    <Text dimColor> Toggle selection</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        /
                    </Text>
                    <Text dimColor> Search / filter</Text>
                </Text>
            </Box>
            <Box flexDirection="column" marginBottom={1}>
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        LISTS (Ports, Mounts, Env)
                    </Text>
                </Box>
                <Text>
                    {" "}
                    <Text bold color="white">
                        a
                    </Text>
                    <Text dimColor> Add new entry</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        d
                    </Text>
                    <Text dimColor> Delete selected entry</Text>
                </Text>
            </Box>
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        ACTIONS
                    </Text>
                </Box>
                <Text>
                    {" "}
                    <Text bold color="white">
                        s
                    </Text>
                    <Text dimColor> Save configuration</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        q
                    </Text>
                    <Text dimColor> Quit</Text>
                </Text>
                <Text>
                    {" "}
                    <Text bold color="white">
                        ?
                    </Text>
                    <Text dimColor> Toggle help</Text>
                </Text>
            </Box>
        </Dialog>
    );

    // ── Preview panel (always visible) ──────────────────────────────
    // `jsonPreview` is computed at the top of the component; see the note near
    // the initial hook block about rules-of-hooks.

    const previewPanel = (
        <PreviewPanel
            focused={focusedPanel === "preview"}
            hadComments={state.hadComments}
            jsonPreview={jsonPreview}
            mode={state.mode}
            scrollRef={previewScrollRef}
        />
    );

    // ── Determine layout ────────────────────────────────────────────

    const isSplitLayout = columns >= MIN_SPLIT_WIDTH;
    const previewWidth = isSplitLayout ? Math.floor(columns * 0.38) : 0;

    // ── Main layout ─────────────────────────────────────────────────

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            {/* VIS badge header */}
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text wrap="truncate">
{state.mode === "create" ? "Create" : "Edit"}
{" "}
devcontainer
                </Text>
            </Box>

            {/* Tab bar */}
            <Box flexShrink={0} paddingX={1} paddingY={1}>
                <Tabs
                    defaultValue={state.section}
                    keyMap={{ useNumbers: false, useTab: false }}
                    onChange={(name: string) => {
                        store.setSection(name as SectionId);
                        setFocusedPanel("editor");
                    }}
                    showIndex={false}
                >
                    {EDITOR_SECTIONS.map(({ id, label }) => (
                        <Tab key={id} name={id}>
                            {label}
                        </Tab>
                    ))}
                </Tabs>
            </Box>

            {/* Section description */}
            <Box flexShrink={0} paddingRight={2}>
                <Text dimColor wrap="truncate">
                    {SECTION_DESCRIPTIONS.get(state.section) ?? ""}
                </Text>
            </Box>

            {/* Content area: editor + preview side-by-side */}
            <Box flexDirection="row" flexGrow={1} overflow="hidden">
                {/* Editor panel */}
                <Box borderColor={focusedPanel === "editor" ? "white" : "gray"} borderStyle="single" flexDirection="column" flexGrow={1} overflow="hidden">
                    {sectionContent}
                </Box>

                {/* Live preview panel (side-by-side on wide terminals) */}
                {isSplitLayout && (
                    <Box flexShrink={0} width={previewWidth}>
                        {previewPanel}
                    </Box>
                )}
            </Box>

            {/* Footer */}
            {footer}

            {/* Dialogs */}
            <QuitDialog
                autoExitSeconds={3}
                onCancel={() => {
                    setQuitDialogVisible(false);
                }}
                visible={quitDialogVisible}
            />
            {helpPopup}
        </Box>
    );
};

export default VisDevcontainerApp;
