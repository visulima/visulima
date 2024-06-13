import { stderr, stdout } from "node:process";

import type { ExtendedRfc5424LogLevels, LiteralUnion, StreamAwareReporter } from "../../types";
import writeStream from "../../utils/write-stream";
import AbstractJsonReporter from "./abstract-json-reporter";

class JsonReporter<L extends string = never> extends AbstractJsonReporter<L> implements StreamAwareReporter<L> {
    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    public constructor() {
        super();

        this.#stdout = stdout;
        this.#stderr = stderr;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout_: NodeJS.WriteStream) {
        this.#stdout = stdout_;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr_: NodeJS.WriteStream) {
        this.#stderr = stderr_;
    }

    protected override _log(message: string, logLevel: LiteralUnion<ExtendedRfc5424LogLevels, L>): void {
        const stream = ["error", "warn"].includes(logLevel as string) ? this.#stderr : this.#stdout;

        writeStream(message + "\n", stream);
    }
}

export default JsonReporter;
