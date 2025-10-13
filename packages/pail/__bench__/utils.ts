import type { ConsolaReporter } from "consola";

export class JsonServerConsolaReporter implements ConsolaReporter {
    public log(logObject, context): void {
        const json = JSON.stringify(logObject);

        const stream = logObject.level < 2 ? context.options.stderr || process.stderr : context.options.stdout || process.stdout;
        const write = stream.__write || stream.write;

        write.call(stream, json);
    }
}

export class JsonBrowserConsolaReporter implements ConsolaReporter {
    _getLogFn(level: number) {
        if (level < 1) {
            return (console as any).__error || console.error;
        }

        if (level === 1) {
            return (console as any).__warn || console.warn;
        }

        return (console as any).__log || console.log;
    }

    public log(logObject, context): void {
        const json = JSON.stringify(logObject);

        const consoleLogFunction = this._getLogFn(logObject.level);

        consoleLogFunction(json);
    }
}
