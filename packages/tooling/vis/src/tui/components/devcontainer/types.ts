export interface DevcontainerBuild {
    args?: Record<string, string>;
    context?: string;
    dockerfile?: string;
}

export interface PortAttributes {
    label?: string;
    onAutoForward?: "ignore" | "notify" | "openBrowser" | "openPreview" | "silent";
    protocol?: "http" | "https";
}

export interface MountEntry {
    source: string;
    target: string;
    type: "bind" | "tmpfs" | "volume";
}

export interface DevcontainerConfig {
    build?: DevcontainerBuild;
    capAdd?: string[];
    containerEnv?: Record<string, string>;
    containerUser?: string;
    customizations?: {
        jetbrains?: { plugins?: string[] };
        vscode?: {
            extensions?: string[];
            settings?: Record<string, unknown>;
        };
    };
    dockerComposeFile?: string | string[];
    features?: Record<string, Record<string, unknown> | string>;
    forwardPorts?: (number | string)[];
    image?: string;
    mounts?: (MountEntry | string)[];
    name?: string;
    onCreateCommand?: string | string[];
    overrideCommand?: boolean;
    portsAttributes?: Record<string, PortAttributes>;
    postAttachCommand?: string | string[];
    postCreateCommand?: string | string[];
    postStartCommand?: string | string[];
    privileged?: boolean;
    remoteEnv?: Record<string, string>;
    remoteUser?: string;
    runServices?: string[];
    securityOpt?: string[];
    service?: string;
    shutdownAction?: string;
    workspaceFolder?: string;
    workspaceMount?: string;
}

export type SectionId = "compose" | "environment" | "extensions" | "features" | "general" | "lifecycle" | "mounts" | "ports";

export const SECTION_ORDER: ReadonlyArray<SectionId> = ["general", "features", "ports", "lifecycle", "extensions", "environment", "mounts", "compose"] as const;
