import { describe, expect, it } from "vitest";

import { DevcontainerStore } from "../../../../src/tui/components/devcontainer/DevcontainerStore";
import type { DevcontainerConfig } from "../../../../src/tui/components/devcontainer/types";

const baseConfig: DevcontainerConfig = {
    features: {},
    image: "mcr.microsoft.com/devcontainers/base:ubuntu",
    name: "Test",
};

describe(DevcontainerStore, () => {
    describe("constructor", () => {
        it("should initialize in create mode when config is null", () => {
            expect.assertions(2);

            const store = new DevcontainerStore(null, false);
            const state = store.getSnapshot();

            expect(state.mode).toBe("create");
            expect(state.showTemplateSelector).toBe(true);
        });

        it("should initialize in edit mode when config is provided", () => {
            expect.assertions(3);

            const store = new DevcontainerStore(baseConfig, false);
            const state = store.getSnapshot();

            expect(state.mode).toBe("edit");
            expect(state.showTemplateSelector).toBe(false);
            expect(state.config.name).toBe("Test");
        });

        it("should deep clone config to prevent external mutation", () => {
            expect.assertions(1);

            const original = { ...baseConfig };
            const store = new DevcontainerStore(original, false);

            original.name = "Mutated";

            expect(store.getSnapshot().config.name).toBe("Test");
        });

        it("should track hadComments flag", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, true);

            expect(store.getSnapshot().hadComments).toBe(true);
        });

        it("should store detected package manager", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false, "pnpm");

            expect(store.getSnapshot().detectedPm).toBe("pnpm");
        });
    });

    describe("subscribe", () => {
        it("should notify listeners on state change", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);
            let called = 0;

            store.subscribe(() => {
                called++;
            });
            store.updateConfig({ name: "Updated" });

            expect(called).toBe(1);
        });

        it("should return unsubscribe function", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);
            let called = 0;

            const unsubscribe = store.subscribe(() => {
                called++;
            });

            unsubscribe();
            store.updateConfig({ name: "Updated" });

            expect(called).toBe(0);
        });
    });

    describe("tab navigation", () => {
        it("should change section and reset field state", () => {
            expect.assertions(3);

            const store = new DevcontainerStore(baseConfig, false);

            store.setFieldIndex(3);
            store.setSection("features");
            const state = store.getSnapshot();

            expect(state.section).toBe("features");
            expect(state.fieldIndex).toBe(0);
            expect(state.fieldEditing).toBe(false);
        });

        it("should cycle through sections with nextSection", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            // general -> features
            store.nextSection();

            expect(store.getSnapshot().section).toBe("features");
        });

        it("should wrap around with previousSection from first", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            // general -> compose (wrap around)
            store.previousSection();

            expect(store.getSnapshot().section).toBe("compose");
        });

        it("should not emit when setting same section", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);
            let calls = 0;

            store.subscribe(() => {
                calls++;
            });
            store.setSection("general");

            expect(calls).toBe(0);
        });
    });

    describe("updateConfig", () => {
        it("should merge partial updates and mark dirty", () => {
            expect.assertions(3);

            const store = new DevcontainerStore(baseConfig, false);

            store.updateConfig({ name: "New Name", remoteUser: "node" });
            const state = store.getSnapshot();

            expect(state.config.name).toBe("New Name");
            expect(state.config.remoteUser).toBe("node");
            expect(state.isDirty).toBe(true);
        });
    });

    describe("features", () => {
        it("should toggle a feature on", () => {
            expect.assertions(2);

            const store = new DevcontainerStore({ ...baseConfig, features: {} }, false);

            store.toggleFeature("ghcr.io/devcontainers/features/node:1");
            const state = store.getSnapshot();

            expect(state.config.features).toHaveProperty("ghcr.io/devcontainers/features/node:1");
            expect(state.isDirty).toBe(true);
        });

        it("should toggle a feature off", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    ...baseConfig,
                    features: { "ghcr.io/devcontainers/features/node:1": {} },
                },
                false,
            );

            store.toggleFeature("ghcr.io/devcontainers/features/node:1");

            expect(store.getSnapshot().config.features).not.toHaveProperty("ghcr.io/devcontainers/features/node:1");
        });

        it("should update feature search and reset field index", () => {
            expect.assertions(2);

            const store = new DevcontainerStore(baseConfig, false);

            store.setFieldIndex(5);
            store.setFeatureSearch("node");

            expect(store.getSnapshot().featureSearch).toBe("node");
            expect(store.getSnapshot().fieldIndex).toBe(0);
        });
    });

    describe("ports", () => {
        it("should add a port", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            store.addPort(3000);

            expect(store.getSnapshot().config.forwardPorts).toStrictEqual([3000]);
        });

        it("should not add duplicate port", () => {
            expect.assertions(1);

            const store = new DevcontainerStore({ ...baseConfig, forwardPorts: [3000] }, false);

            store.addPort(3000);

            expect(store.getSnapshot().config.forwardPorts).toStrictEqual([3000]);
        });

        it("should remove a port", () => {
            expect.assertions(1);

            const store = new DevcontainerStore({ ...baseConfig, forwardPorts: [3000, 8080] }, false);

            store.removePort(0);

            expect(store.getSnapshot().config.forwardPorts).toStrictEqual([8080]);
        });

        it("should set forwardPorts to undefined when removing the last port", () => {
            expect.assertions(1);

            const store = new DevcontainerStore({ ...baseConfig, forwardPorts: [3000] }, false);

            store.removePort(0);

            expect(store.getSnapshot().config.forwardPorts).toBeUndefined();
        });
    });

    describe("extensions", () => {
        it("should toggle an extension on", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            store.toggleExtension("dbaeumer.vscode-eslint");

            expect(store.getSnapshot().config.customizations?.vscode?.extensions).toContain("dbaeumer.vscode-eslint");
        });

        it("should toggle an extension off", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    ...baseConfig,
                    customizations: { vscode: { extensions: ["dbaeumer.vscode-eslint"] } },
                },
                false,
            );

            store.toggleExtension("dbaeumer.vscode-eslint");

            expect(store.getSnapshot().config.customizations?.vscode?.extensions).toBeUndefined();
        });
    });

    describe("environment variables", () => {
        it("should add a container env var", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            store.addEnvVar("container", "NODE_ENV", "development");

            expect(store.getSnapshot().config.containerEnv).toStrictEqual({ NODE_ENV: "development" });
        });

        it("should add a remote env var", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            store.addEnvVar("remote", "EDITOR", "code");

            expect(store.getSnapshot().config.remoteEnv).toStrictEqual({ EDITOR: "code" });
        });

        it("should remove a container env var", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    ...baseConfig,
                    containerEnv: { FOO: "bar", NODE_ENV: "dev" },
                },
                false,
            );

            store.removeEnvVar("container", "FOO");

            expect(store.getSnapshot().config.containerEnv).toStrictEqual({ NODE_ENV: "dev" });
        });

        it("should set containerEnv to undefined when removing the last var", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    ...baseConfig,
                    containerEnv: { FOO: "bar" },
                },
                false,
            );

            store.removeEnvVar("container", "FOO");

            expect(store.getSnapshot().config.containerEnv).toBeUndefined();
        });
    });

    describe("mounts", () => {
        it("should add a mount", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            store.addMount({ source: "vol", target: "/data", type: "volume" });

            expect(store.getSnapshot().config.mounts).toHaveLength(1);
        });

        it("should remove a mount", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    ...baseConfig,
                    mounts: [
                        { source: "a", target: "/a", type: "volume" },
                        { source: "b", target: "/b", type: "volume" },
                    ],
                },
                false,
            );

            store.removeMount(0);

            expect(store.getSnapshot().config.mounts).toHaveLength(1);
        });
    });

    describe("lifecycle commands", () => {
        it("should set a lifecycle command", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(baseConfig, false);

            store.setLifecycleCommand("postCreateCommand", "npm install");

            expect(store.getSnapshot().config.postCreateCommand).toBe("npm install");
        });

        it("should clear a lifecycle command when empty string", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    ...baseConfig,
                    postCreateCommand: "npm install",
                },
                false,
            );

            store.setLifecycleCommand("postCreateCommand", "");

            expect(store.getSnapshot().config.postCreateCommand).toBeUndefined();
        });
    });

    describe("templates", () => {
        it("should apply a template", () => {
            expect.assertions(3);

            const store = new DevcontainerStore(null, false);

            store.applyTemplate("node");
            const state = store.getSnapshot();

            expect(state.config.name).toBe("Node.js");
            expect(state.isDirty).toBe(true);
            expect(state.showTemplateSelector).toBe(false);
        });

        it("should not change state for unknown template id", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(null, false);

            store.applyTemplate("nonexistent");

            expect(store.getSnapshot().showTemplateSelector).toBe(true);
        });
    });

    describe("cleanConfig", () => {
        it("should strip empty strings", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    image: "ubuntu",
                    name: "",
                    workspaceFolder: "",
                },
                false,
            );

            const cleaned = store.cleanConfig();

            expect(cleaned).toStrictEqual({ image: "ubuntu" });
        });

        it("should strip empty arrays", () => {
            expect.assertions(3);

            const store = new DevcontainerStore(
                {
                    capAdd: [],
                    forwardPorts: [],
                    image: "ubuntu",
                    mounts: [],
                    name: "test",
                },
                false,
            );

            const cleaned = store.cleanConfig();

            expect(cleaned.forwardPorts).toBeUndefined();
            expect(cleaned.mounts).toBeUndefined();
            expect(cleaned.capAdd).toBeUndefined();
        });

        it("should strip empty features object", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    features: {},
                    image: "ubuntu",
                    name: "test",
                },
                false,
            );

            expect(store.cleanConfig().features).toBeUndefined();
        });

        it("should strip empty customizations", () => {
            expect.assertions(1);

            const store = new DevcontainerStore(
                {
                    customizations: { vscode: { extensions: [] } },
                    image: "ubuntu",
                    name: "test",
                },
                false,
            );

            expect(store.cleanConfig().customizations).toBeUndefined();
        });

        it("should strip empty env objects", () => {
            expect.assertions(2);

            const store = new DevcontainerStore(
                {
                    containerEnv: {},
                    image: "ubuntu",
                    name: "test",
                    remoteEnv: {},
                },
                false,
            );

            const cleaned = store.cleanConfig();

            expect(cleaned.containerEnv).toBeUndefined();
            expect(cleaned.remoteEnv).toBeUndefined();
        });

        it("should preserve non-empty values", () => {
            expect.assertions(4);

            const store = new DevcontainerStore(
                {
                    features: { "ghcr.io/devcontainers/features/node:1": {} },
                    forwardPorts: [3000],
                    image: "ubuntu",
                    name: "test",
                },
                false,
            );

            const cleaned = store.cleanConfig();

            expect(cleaned.name).toBe("test");
            expect(cleaned.image).toBe("ubuntu");
            expect(cleaned.forwardPorts).toStrictEqual([3000]);
            expect(cleaned.features).toStrictEqual({ "ghcr.io/devcontainers/features/node:1": {} });
        });
    });

    describe("markClean", () => {
        it("should clear isDirty and snapshot originalConfig", () => {
            expect.assertions(2);

            const store = new DevcontainerStore(baseConfig, false);

            store.updateConfig({ name: "Changed" });
            store.markClean();
            const state = store.getSnapshot();

            expect(state.isDirty).toBe(false);
            expect(state.originalConfig?.name).toBe("Changed");
        });
    });
});
