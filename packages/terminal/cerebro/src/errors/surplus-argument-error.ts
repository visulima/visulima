import CerebroError from "./cerebro-error";

/**
 * Error thrown when more positional arguments were supplied than the command
 * declares. A command using named `arguments` knows its exact arity, so a
 * surplus token is a mistake worth reporting rather than discarding in silence.
 */
class SurplusArgumentError extends CerebroError {
    public readonly commandName: string;

    public readonly surplusArguments: ReadonlyArray<string>;

    public constructor(commandName: string, surplusArguments: ReadonlyArray<string>, expected: number) {
        super(
            `Command "${commandName}" accepts ${String(expected)} positional argument${expected === 1 ? "" : "s"}, but got ${String(surplusArguments.length)} extra: ${surplusArguments.join(", ")}`,
            "SURPLUS_ARGUMENT",
            { commandName, surplusArguments: [...surplusArguments] },
        );
        this.name = "SurplusArgumentError";
        this.commandName = commandName;
        this.surplusArguments = surplusArguments;
        this.hint = `Remove the extra argument${surplusArguments.length === 1 ? "" : "s"}, or declare a trailing "multiple: true" argument to collect them.`;
    }
}

export default SurplusArgumentError;
