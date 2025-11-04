import { VERBOSITY_DEBUG } from "./constants";
import PluginError from "./errors/plugin-error";
import type { Plugin, PluginContext } from "./types/plugin";
import type { Toolbox } from "./types/toolbox";

type Logger = Console;

/**
 * Manages plugin lifecycle and execution
 */
class PluginManager<T extends Logger = Logger> {
    private readonly logger: T;

    private readonly plugins = new Map<string, Plugin>();

    private initialized = false;

    private cachedDependencyOrder: Plugin[] | undefined = undefined;

    public constructor(logger: T) {
        this.logger = logger;
    }

    /**
     * Checks if any plugins are registered.
     * @returns True if at least one plugin is registered
     */
    public hasPlugins(): boolean {
        return this.plugins.size > 0;
    }

    /**
     * Registers a plugin.
     * @param plugin The plugin to register
     * @throws {Error} If plugin name is already registered or dependencies are invalid
     */
    public register(plugin: Plugin): void {
        if (this.initialized) {
            throw new Error(`Cannot register plugin "${plugin.name}" after initialization`);
        }

        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin "${plugin.name}" is already registered`);
        }

        if (process.env.CEREBRO_OUTPUT_LEVEL === String(VERBOSITY_DEBUG)) {
            this.logger.debug(`registering plugin: ${plugin.name}`);
        }

        this.plugins.set(plugin.name, plugin);
        this.cachedDependencyOrder = undefined;
    }

    /**
     * Initializes all registered plugins.
     * @param context The plugin context for initialization
     */
    // eslint-disable-next-line sonarjs/cognitive-complexity
    public async init(context: PluginContext): Promise<void> {
        if (this.initialized) {
            throw new Error("PluginManager already initialized");
        }

        if (this.plugins.size === 0) {
            this.logger.debug("no plugins registered, skipping initialization");
            this.initialized = true;

            return;
        }

        this.validateDependencies();

        const orderedPlugins = this.getDependencyOrder();

        this.logger.debug(`initializing ${orderedPlugins.length} plugin(s)...`);

        for (const plugin of orderedPlugins) {
            if (typeof plugin.init === "function") {
                this.logger.debug(`initializing plugin: ${plugin.name}`);

                try {
                    // eslint-disable-next-line no-await-in-loop
                    await plugin.init(context);
                } catch (error) {
                    const pluginError = new PluginError(
                        plugin.name,
                        `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
                        error instanceof Error ? error : undefined,
                    );

                    this.logger.error(pluginError.message);

                    throw pluginError;
                }
            }
        }

        this.initialized = true;
    }

    /**
     * Executes a specific lifecycle hook for all plugins.
     * @param hook The lifecycle hook name
     * @param toolbox The command toolbox (for command-specific hooks)
     * @param result The command result (for afterCommand hook)
     */
    public async executeLifecycle(hook: "beforeCommand" | "afterCommand" | "execute", toolbox: Toolbox, result?: unknown): Promise<void> {
        if (!this.initialized) {
            throw new Error("PluginManager not initialized");
        }

        if (this.plugins.size === 0) {
            return;
        }

        const orderedPlugins = this.getDependencyOrder();

        for (const plugin of orderedPlugins) {
            const hookFunction = plugin[hook];

            if (typeof hookFunction === "function") {
                this.logger.debug(`executing ${hook} hook for plugin: ${plugin.name}`);

                try {
                    // eslint-disable-next-line no-await-in-loop
                    await (hook === "afterCommand"
                        ? (hookFunction as (toolbox: Toolbox, result: unknown) => Promise<void> | void)(toolbox, result)
                        : (hookFunction as (toolbox: Toolbox) => Promise<void> | void)(toolbox));
                } catch (error) {
                    this.logger.error(`Error in ${hook} hook for plugin "${plugin.name}":`, error as Error);

                    throw error;
                }
            }
        }
    }

    /**
     * Executes error handlers for all plugins.
     * @param error The error that occurred
     * @param toolbox The command toolbox
     */
    public async executeErrorHandlers(error: Error, toolbox: Toolbox): Promise<void> {
        if (!this.initialized) {
            return;
        }

        if (this.plugins.size === 0) {
            return;
        }

        const orderedPlugins = this.getDependencyOrder();

        for (const plugin of orderedPlugins) {
            if (typeof plugin.onError === "function") {
                this.logger.debug(`executing error handler for plugin: ${plugin.name}`);

                try {
                    // eslint-disable-next-line no-await-in-loop
                    await plugin.onError(error, toolbox);
                } catch (handlerError) {
                    // Don't throw errors from error handlers
                    this.logger.error(`Error in error handler for plugin "${plugin.name}":`, handlerError as Error);
                }
            }
        }
    }

    /**
     * Gets all registered plugins in dependency order.
     * @returns Array of plugins sorted by dependencies
     */
    public getDependencyOrder(): Plugin[] {
        if (this.cachedDependencyOrder !== undefined) {
            return this.cachedDependencyOrder;
        }

        const ordered: Plugin[] = [];
        const visited = new Set<string>();
        const visiting = new Set<string>();

        const visit = (pluginName: string): void => {
            if (visited.has(pluginName)) {
                return;
            }

            if (visiting.has(pluginName)) {
                throw new Error(`Circular dependency detected involving plugin "${pluginName}"`);
            }

            const plugin = this.plugins.get(pluginName);

            if (!plugin) {
                throw new Error(`Plugin "${pluginName}" not found`);
            }

            visiting.add(pluginName);

            if (plugin.dependencies) {
                for (const dependency of plugin.dependencies) {
                    visit(dependency);
                }
            }

            visiting.delete(pluginName);
            visited.add(pluginName);
            ordered.push(plugin);
        };

        for (const pluginName of this.plugins.keys()) {
            visit(pluginName);
        }

        this.cachedDependencyOrder = ordered;

        return ordered;
    }

    /**
     * Validates that all plugin dependencies exist.
     * @throws {Error} If any dependencies are missing
     */
    private validateDependencies(): void {
        for (const plugin of this.plugins.values()) {
            if (plugin.dependencies) {
                for (const dependency of plugin.dependencies) {
                    if (!this.plugins.has(dependency)) {
                        throw new Error(`Plugin "${plugin.name}" depends on "${dependency}" which is not registered`);
                    }
                }
            }
        }
    }
}

export default PluginManager;
