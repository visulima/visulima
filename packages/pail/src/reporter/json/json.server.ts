import process from "node:process";

import type { LiteralUnion } from "type-fest";

import type { ExtendedRfc5424LogLevels, StreamAwareReporter } from "../../types";
import { writeStream } from "../../util/write-stream";
import { AbstractJsonReporter } from "./abstract-json-reporter";

export class JsonReporter<L extends string = never> extends AbstractJsonReporter<L> implements StreamAwareReporter<L> {
    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    public constructor() {
        super();

        this.#stdout = process.stdout;
        this.#stderr = process.stderr;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout: NodeJS.WriteStream) {
        this.#stdout = stdout;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr: NodeJS.WriteStream) {
        this.#stderr = stderr;
    }

    protected override _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const stream = ["error", "warn"].includes(logLevel as string) ? this.#stderr : this.#stdout;

        writeStream(message + "\n", stream);
    }
}
