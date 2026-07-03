import { VisConfigError } from "./vis-config-error";

const formatChain = (chain: ReadonlyArray<string>): string => chain.join(" → ");

/** An entry in `extends` could not be resolved on disk or via npm. */
export class VisConfigNotFoundError extends VisConfigError {
    public constructor(specifier: string, chain: ReadonlyArray<string>, attempted: ReadonlyArray<string>) {
        const head = chain.length > 0 ? chain[chain.length - 1] : "<unknown>";
        const tried = attempted.length > 0 ? `\nTried:\n  ${attempted.join("\n  ")}` : "";

        super(`Cannot resolve "${specifier}" extended from ${head}.${tried}\nChain: ${formatChain(chain)}`, chain);
    }
}
