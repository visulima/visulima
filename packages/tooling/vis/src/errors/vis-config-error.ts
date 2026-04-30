/**
 * Base class for all `vis.config.ts` / `vis.task.ts` loader failures.
 * Consumers switch on `instanceof VisConfigError` to distinguish loader
 * failures from arbitrary user-code exceptions thrown inside a config.
 */
export class VisConfigError extends Error {
    public readonly chain: ReadonlyArray<string>;

    public constructor(message: string, chain: ReadonlyArray<string>, options?: ErrorOptions) {
        super(message, options);
        this.name = this.constructor.name;
        this.chain = chain;
    }
}
