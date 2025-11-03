import { beforeEach, describe, expect, it, vi } from "vitest";

import PluginError from "../../src/errors/plugin-error";
import PluginManager from "../../src/plugin-manager";
import type { Plugin, PluginContext } from "../../src/types/plugin";
import type { Toolbox } from "../../src/types/toolbox";

describe(PluginManager, () => {
    let mockLogger: {
        debug: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
    };

    let pluginManager: PluginManager;

    beforeEach(() => {
        mockLogger = {
            debug: vi.fn(),
            error: vi.fn(),
        };
        pluginManager = new PluginManager(mockLogger as unknown as Console);
    });

    describe("hasPlugins", () => {
        it("should return false when no plugins registered", () => {
            expect.assertions(1);

            expect(pluginManager.hasPlugins()).toBe(false);
        });

        it("should return true when plugins are registered", () => {
            expect.assertions(1);

            pluginManager.register({
                name: "test-plugin",
            });

            expect(pluginManager.hasPlugins()).toBe(true);
        });
    });

    describe("register", () => {
        it("should register a plugin", () => {
            expect.assertions(2);

            const plugin: Plugin = {
                name: "test-plugin",
            };

            pluginManager.register(plugin);

            expect(pluginManager.hasPlugins()).toBe(true);
            expect(mockLogger.debug).toHaveBeenCalledWith("registering plugin: test-plugin");
        });

        it("should throw error when registering duplicate plugin", () => {
            expect.assertions(2);

            const plugin: Plugin = {
                name: "test-plugin",
            };

            pluginManager.register(plugin);

            expect(() => pluginManager.register(plugin)).toThrow("Plugin \"test-plugin\" is already registered");
            expect(() => pluginManager.register(plugin)).toThrow(Error);
        });

        it("should throw error when registering after initialization", async () => {
            expect.assertions(1);

            const plugin1: Plugin = {
                name: "plugin1",
            };
            const plugin2: Plugin = {
                name: "plugin2",
            };

            pluginManager.register(plugin1);
            await pluginManager.init({} as PluginContext);

            expect(() => pluginManager.register(plugin2)).toThrow("Cannot register plugin \"plugin2\" after initialization");
        });
    });

    describe("init", () => {
        it("should initialize plugin with init function", async () => {
            expect.assertions(2);

            const initFunction = vi.fn().mockResolvedValue(undefined);
            const plugin: Plugin = {
                init: initFunction,
                name: "test-plugin",
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            expect(initFunction).toHaveBeenCalledTimes(1);
            expect(mockLogger.debug).toHaveBeenCalledWith("initializing plugin: test-plugin");
        });

        it("should skip initialization when no plugins registered", async () => {
            expect.assertions(1);

            await pluginManager.init({} as PluginContext);

            expect(mockLogger.debug).toHaveBeenCalledWith("no plugins registered, skipping initialization");
        });

        it("should initialize plugins in dependency order", async () => {
            expect.assertions(1);

            const initOrder: string[] = [];
            const plugin1: Plugin = {
                init: async () => {
                    initOrder.push("plugin1");
                },
                name: "plugin1",
            };
            const plugin2: Plugin = {
                dependencies: ["plugin1"],
                init: async () => {
                    initOrder.push("plugin2");
                },
                name: "plugin2",
            };

            pluginManager.register(plugin2);
            pluginManager.register(plugin1);

            await pluginManager.init({} as PluginContext);

            expect(initOrder).toStrictEqual(["plugin1", "plugin2"]);
        });

        it("should throw error when plugin init fails", async () => {
            expect.assertions(2);

            const initError = new Error("Init failed");
            const plugin: Plugin = {
                init: async () => {
                    throw initError;
                },
                name: "test-plugin",
            };

            pluginManager.register(plugin);

            await expect(pluginManager.init({} as PluginContext)).rejects.toThrow(PluginError);
            expect(mockLogger.error).toHaveBeenCalledWith();
        });

        it("should throw error when dependencies are missing", async () => {
            expect.assertions(2);

            const plugin: Plugin = {
                dependencies: ["missing-plugin"],
                name: "test-plugin",
            };

            pluginManager.register(plugin);

            await expect(pluginManager.init({} as PluginContext)).rejects.toThrow("Plugin \"test-plugin\" depends on \"missing-plugin\" which is not registered");
            await expect(pluginManager.init({} as PluginContext)).rejects.toThrow(Error);
        });

        it("should throw error when circular dependency exists", async () => {
            expect.assertions(1);

            const plugin1: Plugin = {
                dependencies: ["plugin2"],
                name: "plugin1",
            };
            const plugin2: Plugin = {
                dependencies: ["plugin1"],
                name: "plugin2",
            };

            pluginManager.register(plugin1);
            pluginManager.register(plugin2);

            await expect(pluginManager.init({} as PluginContext)).rejects.toThrow("Circular dependency detected involving plugin \"plugin1\"");
        });

        it("should throw error when initializing twice", async () => {
            expect.assertions(1);

            const plugin: Plugin = {
                name: "test-plugin",
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            await expect(pluginManager.init({} as PluginContext)).rejects.toThrow("PluginManager already initialized");
        });
    });

    describe("executeLifecycle", () => {
        it("should throw error when not initialized", async () => {
            expect.assertions(1);

            const toolbox = {} as Toolbox;

            await expect(pluginManager.executeLifecycle("beforeCommand", toolbox)).rejects.toThrow("PluginManager not initialized");
        });

        it("should execute beforeCommand hook", async () => {
            expect.assertions(2);

            const beforeCommandFunction = vi.fn().mockResolvedValue(undefined);
            const plugin: Plugin = {
                beforeCommand: beforeCommandFunction,
                name: "test-plugin",
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            const toolbox = {} as Toolbox;

            await pluginManager.executeLifecycle("beforeCommand", toolbox);

            expect(beforeCommandFunction).toHaveBeenCalledTimes(1);
            expect(beforeCommandFunction).toHaveBeenCalledWith(toolbox);
        });

        it("should execute afterCommand hook with result", async () => {
            expect.assertions(2);

            const afterCommandFunction = vi.fn().mockResolvedValue(undefined);
            const plugin: Plugin = {
                afterCommand: afterCommandFunction,
                name: "test-plugin",
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            const toolbox = {} as Toolbox;
            const result = "test-result";

            await pluginManager.executeLifecycle("afterCommand", toolbox, result);

            expect(afterCommandFunction).toHaveBeenCalledTimes(1);
            expect(afterCommandFunction).toHaveBeenCalledWith(toolbox, result);
        });

        it("should execute execute hook", async () => {
            expect.assertions(2);

            const executeFunction = vi.fn().mockResolvedValue(undefined);
            const plugin: Plugin = {
                execute: executeFunction,
                name: "test-plugin",
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            const toolbox = {} as Toolbox;

            await pluginManager.executeLifecycle("execute", toolbox);

            expect(executeFunction).toHaveBeenCalledTimes(1);
            expect(executeFunction).toHaveBeenCalledWith(toolbox);
        });

        it("should execute hooks in dependency order", async () => {
            expect.assertions(1);

            const executionOrder: string[] = [];
            const plugin1: Plugin = {
                beforeCommand: async () => {
                    executionOrder.push("plugin1");
                },
                name: "plugin1",
            };
            const plugin2: Plugin = {
                beforeCommand: async () => {
                    executionOrder.push("plugin2");
                },
                dependencies: ["plugin1"],
                name: "plugin2",
            };

            pluginManager.register(plugin2);
            pluginManager.register(plugin1);
            await pluginManager.init({} as PluginContext);

            await pluginManager.executeLifecycle("beforeCommand", {} as Toolbox);

            expect(executionOrder).toStrictEqual(["plugin1", "plugin2"]);
        });

        it("should throw error when hook fails", async () => {
            expect.assertions(2);

            const hookError = new Error("Hook failed");
            const plugin: Plugin = {
                beforeCommand: async () => {
                    throw hookError;
                },
                name: "test-plugin",
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            await expect(pluginManager.executeLifecycle("beforeCommand", {} as Toolbox)).rejects.toThrow(hookError);
            expect(mockLogger.error).toHaveBeenCalledWith();
        });

        it("should skip plugins without hook function", async () => {
            expect.assertions(1);

            const plugin: Plugin = {
                name: "test-plugin",
                // No beforeCommand hook
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            await expect(pluginManager.executeLifecycle("beforeCommand", {} as Toolbox)).resolves.not.toThrow();
        });
    });

    describe("executeErrorHandlers", () => {
        it("should not execute when not initialized", async () => {
            expect.assertions(1);

            const error = new Error("Test error");
            const toolbox = {} as Toolbox;

            await pluginManager.executeErrorHandlers(error, toolbox);

            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it("should execute onError hook", async () => {
            expect.assertions(2);

            const onErrorFunction = vi.fn().mockResolvedValue(undefined);
            const plugin: Plugin = {
                name: "test-plugin",
                onError: onErrorFunction,
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            const error = new Error("Test error");
            const toolbox = {} as Toolbox;

            await pluginManager.executeErrorHandlers(error, toolbox);

            expect(onErrorFunction).toHaveBeenCalledTimes(1);
            expect(onErrorFunction).toHaveBeenCalledWith(error, toolbox);
        });

        it("should not throw when error handler fails", async () => {
            expect.assertions(2);

            const handlerError = new Error("Handler failed");
            const plugin: Plugin = {
                name: "test-plugin",
                onError: async () => {
                    throw handlerError;
                },
            };

            pluginManager.register(plugin);
            await pluginManager.init({} as PluginContext);

            const error = new Error("Test error");

            await expect(pluginManager.executeErrorHandlers(error, {} as Toolbox)).resolves.not.toThrow();
            expect(mockLogger.error).toHaveBeenCalledWith();
        });

        it("should execute error handlers in dependency order", async () => {
            expect.assertions(1);

            const executionOrder: string[] = [];
            const plugin1: Plugin = {
                name: "plugin1",
                onError: async () => {
                    executionOrder.push("plugin1");
                },
            };
            const plugin2: Plugin = {
                dependencies: ["plugin1"],
                name: "plugin2",
                onError: async () => {
                    executionOrder.push("plugin2");
                },
            };

            pluginManager.register(plugin2);
            pluginManager.register(plugin1);
            await pluginManager.init({} as PluginContext);

            await pluginManager.executeErrorHandlers(new Error("Test"), {} as Toolbox);

            expect(executionOrder).toStrictEqual(["plugin1", "plugin2"]);
        });
    });

    describe("getDependencyOrder", () => {
        it("should return plugins in dependency order", () => {
            expect.assertions(1);

            const plugin1: Plugin = { name: "plugin1" };
            const plugin2: Plugin = { dependencies: ["plugin1"], name: "plugin2" };
            const plugin3: Plugin = { dependencies: ["plugin2"], name: "plugin3" };

            pluginManager.register(plugin3);
            pluginManager.register(plugin1);
            pluginManager.register(plugin2);

            const order = pluginManager.getDependencyOrder();

            expect(order.map((p) => p.name)).toStrictEqual(["plugin1", "plugin2", "plugin3"]);
        });

        it("should throw error for circular dependency", () => {
            expect.assertions(1);

            const plugin1: Plugin = { dependencies: ["plugin2"], name: "plugin1" };
            const plugin2: Plugin = { dependencies: ["plugin1"], name: "plugin2" };

            pluginManager.register(plugin1);
            pluginManager.register(plugin2);

            expect(() => pluginManager.getDependencyOrder()).toThrow("Circular dependency detected involving plugin \"plugin1\"");
        });

        it("should throw error for missing dependency", () => {
            expect.assertions(1);

            const plugin: Plugin = { dependencies: ["missing"], name: "plugin" };

            pluginManager.register(plugin);

            expect(() => pluginManager.getDependencyOrder()).toThrow("Plugin \"missing\" not found");
        });

        it("should cache dependency order", () => {
            expect.assertions(2);

            const plugin1: Plugin = { name: "plugin1" };
            const plugin2: Plugin = { name: "plugin2" };

            pluginManager.register(plugin1);
            pluginManager.register(plugin2);

            const order1 = pluginManager.getDependencyOrder();
            const order2 = pluginManager.getDependencyOrder();

            expect(order1).toBe(order2); // Same reference (cached)
            expect(order1.map((p) => p.name)).toStrictEqual(["plugin1", "plugin2"]);
        });
    });
});
