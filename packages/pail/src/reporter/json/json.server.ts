import process from "node:process";

import type { Rfc5424LogLevels, StreamAwareReporter } from "../../types";
import { writeStream } from "../../util/write-stream";
import { AbstractJsonReporter } from "./abstract-json-reporter";

export class JsonReporter<L extends string = never> extends AbstractJsonReporter<L> implements StreamAwareReporter<L> {
    #stdout: NodeJS.WriteStream | undefined;

    #stderr: NodeJS.WriteStream | undefined;

    public constructor() {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout: NodeJS.WriteStream) {
        this.#stdout = stdout;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr: NodeJS.WriteStream) {
        this.#stderr = stderr;
    }

    protected override _log(message: string, logLevel: L | Rfc5424LogLevels): void {
        const stream = ["error", "warn"].includes(logLevel) ? this.#stderr ?? process.stderr : this.#stdout ?? process.stdout;

        writeStream(`${message}\n`, stream);
    }
}
