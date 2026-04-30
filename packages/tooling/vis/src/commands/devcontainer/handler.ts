import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import { detectPm } from "../../pm/pm-runner";
import type { PackageManager } from "../../tui/components/devcontainer/catalogs/mount-suggestions";
import { TEMPLATES } from "../../tui/components/devcontainer/catalogs/templates";
import { readDevcontainerJson, writeDevcontainerJson } from "../../tui/components/devcontainer/devcontainer-io";
import { DevcontainerStore } from "../../tui/components/devcontainer/DevcontainerStore";
import type { DevcontainerConfig } from "../../tui/components/devcontainer/types";
import VisDevcontainerApp from "../../tui/components/devcontainer/VisDevcontainerApp";
import type { DevcontainerOptions } from "./index";

const execute = async ({ logger, options, workspaceRoot: wsRoot }: Toolbox<Console, DevcontainerOptions>): Promise<void> => {
    if (!wsRoot) {
        throw new Error("Could not determine workspace root. Run this command inside a monorepo or project directory.");
    }

    const workspaceRoot = wsRoot;
    const templateId = options.template;
    const outputPath = options.output;
    const isTTY = Boolean(process.stdout.isTTY) && !isInCi;

    // Detect package manager
    let detectedPm: PackageManager | null = null;

    try {
        const pmInfo = detectPm(workspaceRoot);

        detectedPm = pmInfo.name as PackageManager;
    } catch {
        // Could not detect — will be null
    }

    // Try to read existing devcontainer.json
    const existing = readDevcontainerJson(workspaceRoot);
    let initialConfig = existing?.config ?? null;
    const hadComments = existing?.hadComments ?? false;

    // If --template provided, use that as starting config
    if (templateId && !existing) {
        const template = TEMPLATES.find((t) => t.id === templateId);

        if (!template) {
            const validIds = TEMPLATES.map((t) => t.id).join(", ");

            throw new Error(`Unknown template "${templateId}". Valid templates: ${validIds}`);
        }

        initialConfig = template.config;
    }

    // Non-TTY mode: output JSON or generate from template
    if (!isTTY) {
        if (initialConfig) {
            logger.info(JSON.stringify(initialConfig, null, 2));
        } else {
            logger.error("No existing devcontainer.json found. Use --template to generate one in non-TTY mode.");
            process.exitCode = 1;
        }

        return;
    }

    // Ensure stdin is in the right state for ink
    if (process.stdin.isTTY && typeof process.stdin.setRawMode === "function") {
        process.stdin.setRawMode(true);
        process.stdin.ref();
        process.stdin.resume();
    }

    // Keep event loop alive while TUI is active
    const keepAlive = setInterval(() => {}, 1000);

    const store = new DevcontainerStore(initialConfig, hadComments, detectedPm);

    // If --template is provided in create mode, apply it and skip selector
    if (templateId && !existing) {
        store.dismissTemplateSelector();
    }

    let savedConfig: DevcontainerConfig | null = null;

    const instance = render(
        React.createElement(VisDevcontainerApp, {
            onSave: (config: DevcontainerConfig) => {
                writeDevcontainerJson(workspaceRoot, config, outputPath);
                savedConfig = config;
            },
            store,
        }),
        {
            alternateScreen: true,
            exitOnCtrlC: false,
            interactive: true,
            patchConsole: true,
        },
    );

    await instance.waitUntilExit();
    clearInterval(keepAlive);

    if (savedConfig) {
        const target = outputPath ?? ".devcontainer/devcontainer.json";

        logger.info(`DevContainer config saved to ${target}`);
    }
};

export default execute as CommandExecute<Toolbox>;
