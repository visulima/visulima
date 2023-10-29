import type { UpdateNotifierOptions } from "../update-notifier/has-new-version";
import type { Command as ICommand } from "./command";
import type { Extension as IExtension } from "./extension";
import type { Options as IOptions } from "./options";

export type CommandSection = { footer?: string; header: string }

export interface Cli {
    /**
     * Add an arbitrary command to the CLI.
     *
     * @param command The command to add.
     *
     * @return self
     */
    addCommand: (command: ICommand) => this;

    /**
     * Adds an extension so it is available when commands execute. They usually live
     * the given name on the toolbox object passed to commands, but are able
     * to manipulate the toolbox object however they want. The second
     * parameter is a function that allows the extension to attach itself.
     *
     * @param extension The extension to add.
     *
     * @return self
     */
    addExtension: (extension: IExtension) => this;

    enableUpdateNotifier: ({ alwaysRun, distTag, updateCheckInterval }: Omit<UpdateNotifierOptions, "debug | pkg">) => this;

    getCliName: () => string;

    getCommandSection: () => CommandSection;

    getCommands: () => Map<string, ICommand>;

    getCwd: () => string;

    getPackageName: () => string;

    getPackageVersion: () => string;

    run: (extraOptions: IOptions) => Promise<void>;

    setCommandSection: (commandSection: CommandSection) => this

    /**
     * Set a default command, to display a different command if cli is call without command.
     *
     * @param commandName
     *
     * @return self
     */
    setDefaultCommand: (commandName: string) => this;
}
