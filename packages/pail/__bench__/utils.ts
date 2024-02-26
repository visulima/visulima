import type { ConsolaReporter } from "consola";

export class JsonServerConsolaReporter implements ConsolaReporter {
    public log(logObj, ctx): void {
        const json = JSON.stringify(logObj);

        const stream = logObj.level < 2 ? ctx.options.stderr || process.stderr : ctx.options.stdout || process.stdout;
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

    public log(logObj, ctx): void {
        const json = JSON.stringify(logObj);

        const consoleLogFn = this._getLogFn(logObj.level);

        consoleLogFn(json);
    }
}
