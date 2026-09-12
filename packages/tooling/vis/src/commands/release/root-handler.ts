import type { CommandExecute, Toolbox } from "@visulima/cerebro";

/**
 * `vis release` with no subcommand — prints the subcommand listing.
 *
 * Rendering goes through cerebro's own help command so the output is
 * identical to `vis release --help`. It is invoked as a *method call*
 * (`helpCommand.execute(...)`, the same form `executeCommand` uses) because
 * `HelpCommand` is class-based and reads `this.commands`; and directly
 * rather than via `runtime.runCommand("help", …)` so the plugin lifecycle
 * — upgrade check, tips, sponsor notice — doesn't fire a second time.
 */
const execute = async (toolbox: Toolbox): Promise<void> => {
    const helpCommand = toolbox.runtime.getCommands().get("help");

    if (typeof helpCommand?.execute !== "function") {
        toolbox.logger.info("Run \"vis release <subcommand> --help\" — for example \"vis release status --help\".");

        return;
    }

    // `commandName: "help"` + the positional `["release"]` is exactly what
    // `vis help release` produces, which resolves to this command and renders
    // its Subcommands section.
    await helpCommand.execute({ ...toolbox, argument: ["release"], commandName: "help" });
};

export default execute as CommandExecute<Toolbox>;
