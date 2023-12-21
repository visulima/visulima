import process from "node:process";

import type { DefaultLogLevels, StreamAwareReporter } from "../../types";
import writeStream from "../../util/write-stream";
import type { Options } from "./abstract-json-reporter";
import { AbstractJsonReporter } from "./abstract-json-reporter";

class JsonReporter<L extends string = never> extends AbstractJsonReporter<L> implements StreamAwareReporter<L> {
    private _stdout: NodeJS.WriteStream | undefined;

    private _stderr: NodeJS.WriteStream | undefined;

    public constructor(options: Options = {}) {
        super(options);
    }

    public setStdout(stdout: NodeJS.WriteStream) {
        this._stdout = stdout;
    }

    public setStderr(stderr: NodeJS.WriteStream) {
        this._stderr = stderr;
    }

    protected override _log(message: string, logLevel: DefaultLogLevels | L) {
        writeStream(`${message}\n`, ["error", "warn"].includes(logLevel) ? this._stderr ?? process.stderr : this._stdout ?? process.stdout);
    }
}

export default JsonReporter;
