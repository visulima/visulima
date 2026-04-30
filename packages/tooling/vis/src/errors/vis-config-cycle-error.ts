import { VisConfigError } from "./vis-config-error";

/** An `extends` chain re-enters a path that is still loading. */
export class VisConfigCycleError extends VisConfigError {
    public constructor(reentered: string, chain: ReadonlyArray<string>) {
        const trail = [...chain, `${reentered} (re-enters)`].join(" → ");

        super(`Config cycle: ${trail}`, chain);
    }
}
