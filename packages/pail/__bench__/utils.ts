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
    public log(logObject, context): void {
        const json = JSON.stringify(logObject);

        const stream = logObject.level < 2 ? context.options.stderr || process.stderr : context.options.stdout || process.stdout;
        const write = stream.__write || stream.write;

        write.call(stream, json);
    }
}
