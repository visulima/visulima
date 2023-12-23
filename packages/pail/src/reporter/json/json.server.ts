import process from "node:process";

import type { Rfc5424LogLevels, StreamAwareReporter } from "../../types";
import writeStream from "../../util/write-stream";
import AbstractJsonReporter from "./abstract-json-reporter";

class JsonReporter<L extends string = never> extends AbstractJsonReporter<L> implements StreamAwareReporter<L> {
    private _stdout: NodeJS.WriteStream | undefined;

    private _stderr: NodeJS.WriteStream | undefined;

    public constructor() {
        super();
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout: NodeJS.WriteStream) {
        this._stdout = stdout;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr: NodeJS.WriteStream) {
        this._stderr = stderr;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    protected override _log(message: string, logLevel: L | Rfc5424LogLevels) {
        writeStream(`${message}\n`, ["error", "warn"].includes(logLevel) ? this._stderr ?? process.stderr : this._stdout ?? process.stdout);
    }
}

export default JsonReporter;
