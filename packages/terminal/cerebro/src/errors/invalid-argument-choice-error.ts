import CerebroError from "./cerebro-error";

/**
 * Error thrown when a positional argument's value is not one of its declared
 * `choices`.
 *
 * Distinct from `InvalidChoiceError`, which phrases its hint as `--&lt;option>
 * &lt;value>`. A positional has no flag, so that hint would name something the
 * command does not declare.
 */
class InvalidArgumentChoiceError extends CerebroError {
    public readonly argument: string;

    public readonly choices: ReadonlyArray<string>;

    public readonly value: string;

    public constructor(argument: string, value: string, choices: ReadonlyArray<string>) {
        super(`Invalid value "${value}" for argument "${argument}". Allowed values: ${choices.join(", ")}`, "INVALID_CHOICE", { argument, choices, value });
        // eslint-disable-next-line no-secrets/no-secrets -- the class name, not a credential
        this.name = "InvalidArgumentChoiceError";
        this.argument = argument;
        this.value = value;
        this.choices = choices;
        this.hint = `Pass one of: ${choices.join(", ")}`;
    }
}

export default InvalidArgumentChoiceError;
