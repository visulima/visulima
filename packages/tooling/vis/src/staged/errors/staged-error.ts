/**
 * Base class for all staged-workflow errors. Consumers switch on
 * `instanceof StagedError` to distinguish our failures from arbitrary
 * task exceptions.
 */
export class StagedError extends Error {
    public constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = this.constructor.name;
    }
}
