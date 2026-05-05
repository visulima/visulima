import type { PackageManager } from "./catalogs/mount-suggestions";
import { getSuggestedMounts } from "./catalogs/mount-suggestions";
import type { DevcontainerTemplate } from "./catalogs/templates";
import { TEMPLATES } from "./catalogs/templates";
import type { DevcontainerConfig, MountEntry, SectionId } from "./types";
import { SECTION_ORDER } from "./types";

// ── State Shape ─────────────────────────────────────────────────────────

export interface DevcontainerState {
    /** The configuration being edited. */
    config: DevcontainerConfig;
    /** Detected package manager from the workspace. */
    detectedPm: PackageManager | null;
    /** Search text for extensions section. */
    extensionSearch: string;
    /** Search text for features section. */
    featureSearch: string;
    /** Whether any field is being actively edited via TextInput. */
    fieldEditing: boolean;
    /** Which field is focused within the current section. */
    fieldIndex: number;
    /** Whether the original file contained JSONC comments (warning on save). */
    hadComments: boolean;
    /** Whether config has been changed since load/save. */
    isDirty: boolean;
    /** Create or edit mode. */
    mode: "create" | "edit";
    /** Original config for diffing (null in create mode). */
    originalConfig: DevcontainerConfig | null;
    /** Currently active tab/section. */
    section: SectionId;
    /** Whether to show the template selector dialog. */
    showTemplateSelector: boolean;
    /** Suggested mounts based on PM and features. */
    suggestedMounts: MountEntry[];
    /** Selected template index in the selector. */
    templateIndex: number;
}

type Listener = () => void;

// ── Helpers ─────────────────────────────────────────────────────────────

const deepClone = <T>(value: T): T => structuredClone(value);

// ── DevcontainerStore ───────────────────────────────────────────────────

export class DevcontainerStore {
    #listeners = new Set<Listener>();

    #state: DevcontainerState;

    public constructor(config: DevcontainerConfig | null, hadComments: boolean, detectedPm: PackageManager | null = null) {
        const isCreate = config === null;
        const initial = config ?? { name: "" };
        const cloned = deepClone(initial);

        this.#state = {
            config: cloned,
            detectedPm,
            extensionSearch: "",
            featureSearch: "",
            fieldEditing: false,
            fieldIndex: 0,
            hadComments,
            isDirty: false,
            mode: isCreate ? "create" : "edit",
            originalConfig: isCreate ? null : deepClone(initial),
            section: "general",
            showTemplateSelector: isCreate,
            suggestedMounts: getSuggestedMounts(detectedPm, cloned.features ?? {}, cloned.mounts ?? []),
            templateIndex: 0,
        };
    }

    // ── React integration ───────────────────────────────────────────

    public getSnapshot = (): DevcontainerState => this.#state;

    public subscribe = (listener: Listener): (() => void) => {
        this.#listeners.add(listener);

        return () => {
            this.#listeners.delete(listener);
        };
    };

    // ── Tab navigation ──────────────────────────────────────────────

    public setSection(section: SectionId): void {
        if (section !== this.#state.section) {
            this.#emit({
                ...this.#state,
                fieldEditing: false,
                fieldIndex: 0,
                section,
            });
        }
    }

    public nextSection(): void {
        const current = SECTION_ORDER.indexOf(this.#state.section);
        const next = (current + 1) % SECTION_ORDER.length;

        this.setSection(SECTION_ORDER[next] as SectionId);
    }

    public previousSection(): void {
        const current = SECTION_ORDER.indexOf(this.#state.section);
        const previous = (current - 1 + SECTION_ORDER.length) % SECTION_ORDER.length;

        this.setSection(SECTION_ORDER[previous] as SectionId);
    }

    // ── Field navigation ────────────────────────────────────────────

    public setFieldIndex(index: number): void {
        if (index !== this.#state.fieldIndex) {
            this.#emit({ ...this.#state, fieldIndex: Math.max(0, index) });
        }
    }

    public setFieldEditing(editing: boolean): void {
        if (editing !== this.#state.fieldEditing) {
            this.#emit({ ...this.#state, fieldEditing: editing });
        }
    }

    // ── Template selector ───────────────────────────────────────────

    public setTemplateIndex(index: number): void {
        const clamped = Math.max(0, Math.min(index, TEMPLATES.length - 1));

        if (clamped !== this.#state.templateIndex) {
            this.#emit({ ...this.#state, templateIndex: clamped });
        }
    }

    public applyTemplate(templateId: string): void {
        const template = TEMPLATES.find((t: DevcontainerTemplate) => t.id === templateId);

        if (template) {
            this.#emit(
                this.#withSuggestions({
                    ...this.#state,
                    config: deepClone(template.config),
                    isDirty: true,
                    showTemplateSelector: false,
                }),
            );
        }
    }

    public dismissTemplateSelector(): void {
        this.#emit({ ...this.#state, showTemplateSelector: false });
    }

    // ── General config updates ──────────────────────────────────────

    public updateConfig(partial: Partial<DevcontainerConfig>): void {
        this.#emit({
            ...this.#state,
            config: { ...this.#state.config, ...partial },
            isDirty: true,
        });
    }

    // ── Features ────────────────────────────────────────────────────

    public toggleFeature(featureId: string): void {
        const features = { ...this.#state.config.features };

        if (features[featureId] === undefined) {
            features[featureId] = {};
        } else {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete features[featureId];
        }

        this.#emit(
            this.#withSuggestions({
                ...this.#state,
                config: { ...this.#state.config, features },
                isDirty: true,
            }),
        );
    }

    public setFeatureSearch(search: string): void {
        this.#emit({ ...this.#state, featureSearch: search, fieldIndex: 0 });
    }

    // ── Ports ───────────────────────────────────────────────────────

    public addPort(port: number | string): void {
        const existing = this.#state.config.forwardPorts ?? [];

        // Prevent duplicates
        if (existing.includes(port)) {
            return;
        }

        const ports = [...existing, port];

        this.#emit({
            ...this.#state,
            config: { ...this.#state.config, forwardPorts: ports },
            isDirty: true,
        });
    }

    public removePort(index: number): void {
        const ports = [...(this.#state.config.forwardPorts ?? [])];

        ports.splice(index, 1);

        this.#emit({
            ...this.#state,
            config: { ...this.#state.config, forwardPorts: ports.length > 0 ? ports : undefined },
            isDirty: true,
        });
    }

    // ── Extensions ──────────────────────────────────────────────────

    public toggleExtension(extensionId: string): void {
        const customizations = { ...this.#state.config.customizations };
        const vscode = { ...customizations.vscode };
        const extensions = [...(vscode.extensions ?? [])];
        const index = extensions.indexOf(extensionId);

        if (index === -1) {
            extensions.push(extensionId);
        } else {
            extensions.splice(index, 1);
        }

        vscode.extensions = extensions.length > 0 ? extensions : undefined;
        customizations.vscode = vscode.extensions || vscode.settings ? vscode : undefined;

        this.#emit({
            ...this.#state,
            config: {
                ...this.#state.config,
                customizations: customizations.vscode || customizations.jetbrains ? customizations : undefined,
            },
            isDirty: true,
        });
    }

    public setExtensionSearch(search: string): void {
        this.#emit({ ...this.#state, extensionSearch: search, fieldIndex: 0 });
    }

    // ── Environment variables ───────────────────────────────────────

    public addEnvVar(target: "container" | "remote", key: string, value: string): void {
        const field = target === "container" ? "containerEnv" : "remoteEnv";
        const env = { ...this.#state.config[field], [key]: value };

        this.#emit({
            ...this.#state,
            config: { ...this.#state.config, [field]: env },
            isDirty: true,
        });
    }

    public removeEnvVar(target: "container" | "remote", key: string): void {
        const field = target === "container" ? "containerEnv" : "remoteEnv";
        const env = { ...this.#state.config[field] };

        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete env[key];

        this.#emit({
            ...this.#state,
            config: { ...this.#state.config, [field]: Object.keys(env).length > 0 ? env : undefined },
            isDirty: true,
        });
    }

    // ── Mounts ──────────────────────────────────────────────────────

    public addMount(mount: MountEntry): void {
        const mounts = [...(this.#state.config.mounts ?? []), mount];

        this.#emit(
            this.#withSuggestions({
                ...this.#state,
                config: { ...this.#state.config, mounts },
                isDirty: true,
            }),
        );
    }

    public removeMount(index: number): void {
        const mounts = [...(this.#state.config.mounts ?? [])];

        mounts.splice(index, 1);

        this.#emit(
            this.#withSuggestions({
                ...this.#state,
                config: { ...this.#state.config, mounts: mounts.length > 0 ? mounts : undefined },
                isDirty: true,
            }),
        );
    }

    /** Add all currently suggested mounts to the config. */
    public applySuggestedMounts(): void {
        if (this.#state.suggestedMounts.length === 0) {
            return;
        }

        const mounts = [...(this.#state.config.mounts ?? []), ...this.#state.suggestedMounts];

        this.#emit(
            this.#withSuggestions({
                ...this.#state,
                config: { ...this.#state.config, mounts },
                isDirty: true,
            }),
        );
    }

    // ── Lifecycle commands ───────────────────────────────────────────

    public setLifecycleCommand(hook: "onCreateCommand" | "postAttachCommand" | "postCreateCommand" | "postStartCommand", command: string): void {
        this.#emit({
            ...this.#state,
            config: { ...this.#state.config, [hook]: command || undefined },
            isDirty: true,
        });
    }

    // ── Save lifecycle ────────────────────────────────────────────────

    public markClean(): void {
        this.#emit({
            ...this.#state,
            isDirty: false,
            originalConfig: deepClone(this.#state.config),
        });
    }

    // ── Preview / Serialization ─────────────────────────────────────

    public getJsonPreview(): string {
        return JSON.stringify(this.#cleanConfig(), null, 2);
    }

    /** Return a cleaned config with empty/undefined fields stripped. */
    public cleanConfig(): DevcontainerConfig {
        return this.#cleanConfig();
    }

    // ── Internal ────────────────────────────────────────────────────

    #cleanConfig(): DevcontainerConfig {
        // JSON round-trip: drops undefined values, safe for plain JSON config objects
        const config = deepClone(this.#state.config);

        // Remove empty string values at top level
        for (const [key, value] of Object.entries(config)) {
            if (value === "" || value === undefined) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete (config as Record<string, unknown>)[key];
            }
        }

        // Remove empty strings in build sub-object
        if (config.build) {
            if (config.build.dockerfile === "") {
                delete config.build.dockerfile;
            }

            if (config.build.context === "") {
                delete config.build.context;
            }

            if (config.build.args && Object.keys(config.build.args).length === 0) {
                delete config.build.args;
            }

            if (Object.keys(config.build).length === 0) {
                delete config.build;
            }
        }

        // Remove empty arrays
        if (config.forwardPorts?.length === 0) {
            delete config.forwardPorts;
        }

        if (config.mounts?.length === 0) {
            delete config.mounts;
        }

        if (config.runServices?.length === 0) {
            delete config.runServices;
        }

        if (config.capAdd?.length === 0) {
            delete config.capAdd;
        }

        if (config.securityOpt?.length === 0) {
            delete config.securityOpt;
        }

        // Remove empty features object
        if (config.features && Object.keys(config.features).length === 0) {
            delete config.features;
        }

        // Remove empty customizations
        if (config.customizations?.vscode?.extensions?.length === 0) {
            delete config.customizations.vscode.extensions;
        }

        if (config.customizations?.vscode && Object.keys(config.customizations.vscode).length === 0) {
            delete config.customizations.vscode;
        }

        if (config.customizations && Object.keys(config.customizations).length === 0) {
            delete config.customizations;
        }

        // Remove empty env objects
        if (config.containerEnv && Object.keys(config.containerEnv).length === 0) {
            delete config.containerEnv;
        }

        if (config.remoteEnv && Object.keys(config.remoteEnv).length === 0) {
            delete config.remoteEnv;
        }

        return config;
    }

    /** Recalculate suggested mounts for the given state. */
    // eslint-disable-next-line class-methods-use-this -- private method; co-located with state-mutating helpers for symmetry
    #withSuggestions(state: DevcontainerState): DevcontainerState {
        return {
            ...state,
            suggestedMounts: getSuggestedMounts(state.detectedPm, state.config.features ?? {}, state.config.mounts ?? []),
        };
    }

    #emit(newState: DevcontainerState): void {
        this.#state = newState;

        for (const listener of this.#listeners) {
            try {
                listener();
            } catch {
                // Isolate listener errors
            }
        }
    }
}
