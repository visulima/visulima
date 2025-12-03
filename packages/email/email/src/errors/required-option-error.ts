import EmailError from "./email-error";

/**
 * Error for missing required options
 * @param component The component name where the error occurred
 * @param name The name(s) of the missing required option(s)
 */
class RequiredOptionError extends EmailError {
    public constructor(component: string, name: string | string[]) {
        const message = Array.isArray(name) ? `Missing required options: ${name.map((n) => `'${n}'`).join(", ")}` : `Missing required option: '${name}'`;

        super(component, message, {
            hint: Array.isArray(name)
                ? `Please provide the following required options: ${name.map((n) => `'${n}'`).join(", ")}`
                : `Please provide the required option: '${name}'`,
        });
        this.name = "RequiredOptionError";
    }
}

export default RequiredOptionError;
