import type PluginManager from "../plugin-manager";
import type { Command as ICommand, OptionDefinition } from "./command";
import type { Plugin } from "./plugin";

export type CommandSection = { footer?: string; header?: string };

export type CliRunOptions = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
    shouldExitProcess?: boolean;
};

export interface Cli {
    /**
     * Add an arbitrary command to the CLI.
     * @param command The command to add.
     * @returns self
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addCommand: <OD extends OptionDefinition<any> = any>(command: ICommand<OD>) => this;

    /**
     * Add a plugin to extend the CLI functionality
     * @param plugin The plugin to add.
     * @returns self
     */
    addPlugin: (plugin: Plugin) => this;

    getCliName: () => string;

    getCommands: () => Map<string, ICommand>;

    getCommandSection: () => CommandSection;

    getCwd: () => string;

    getPackageName: () => string | undefined;

    getPackageVersion: () => string | undefined;

    /**
     * Get the plugin manager instance
     * @returns The plugin manager
     */
    getPluginManager: () => PluginManager;

    run: (extraOptions: CliRunOptions) => Promise<void>;

    setCommandSection: (commandSection: CommandSection) => this;

    /**
     * Set a default command, to display a different command if cli is call without command.
     * @param commandName
     * @returns self
     */
    setDefaultCommand: (commandName: string) => this;
}
