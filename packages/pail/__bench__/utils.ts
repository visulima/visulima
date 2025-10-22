/* eslint-disable max-classes-per-file */
import type { ConsolaOptions, ConsolaReporter, LogObject } from "consola";

export class JsonServerConsolaReporter implements ConsolaReporter {
    // eslint-disable-next-line class-methods-use-this
    public log(
        logObject: LogObject,
        context: {
            options: ConsolaOptions;
        },
    ): void {
        const json = JSON.stringify(logObject);

        const stream = logObject.level < 2 ? context.options.stderr || process.stderr : context.options.stdout || process.stdout;
        // @ts-expect-error - dynamic property
        // eslint-disable-next-line no-underscore-dangle
        const write = stream.__write || stream.write;

        write.call(stream, json);
    }
}

export class JsonBrowserConsolaReporter implements ConsolaReporter {
    // eslint-disable-next-line class-methods-use-this, sonarjs/no-identical-functions
    public log(
        logObject: LogObject,
        context: {
            options: ConsolaOptions;
        },
    ): void {
        const json = JSON.stringify(logObject);

        const stream = logObject.level < 2 ? context.options.stderr || process.stderr : context.options.stdout || process.stdout;
        // @ts-expect-error - dynamic property
        // eslint-disable-next-line no-underscore-dangle
        const write = stream.__write || stream.write;

        write.call(stream, json);
    }
}
