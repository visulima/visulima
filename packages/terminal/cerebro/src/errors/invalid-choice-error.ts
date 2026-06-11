import CerebroError from "./cerebro-error";

/**
 * Error thrown when an option value is not one of its declared `choices`.
 */
class InvalidChoiceError extends CerebroError {
    public readonly choices: ReadonlyArray<string>;

    public readonly option: string;

    public readonly value: string;

    public constructor(option: string, value: string, choices: ReadonlyArray<string>) {
        super(`Invalid value "${value}" for option "${option}". Allowed values: ${choices.join(", ")}`, "INVALID_CHOICE", { choices, option, value });
        this.name = "InvalidChoiceError";
        this.option = option;
        this.value = value;
        this.choices = choices;
        this.hint = `Use one of: ${choices.map((choice) => `--${option} ${choice}`).join(", ")}`;
    }
}

export default InvalidChoiceError;
