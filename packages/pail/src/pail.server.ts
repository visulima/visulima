import type { LiteralUnion } from "type-fest";

import InteractiveManager from "./interactive/interactive-manager";
import InteractiveStreamHook from "./interactive/interactive-stream-hook";
import { PailBrowserImpl } from "./pail.browser";
import RawReporter from "./reporter/raw/raw.server";
import type {
    ConstructorOptions,
    DefaultLogTypes,
    InteractiveStreamReporter,
    LoggerFunction,
    LoggerTypesAwareReporter,
    Reporter,
    ServerConstructorOptions,
    StreamAwareReporter,
    StringifyAwareReporter,
} from "./types";
import { clearTerminal } from "./utils/ansi-escapes";

class PailServerImpl<T extends string = string, L extends string = string> extends PailBrowserImpl<T, L> {
    protected readonly stdout: NodeJS.WriteStream;

    protected readonly stderr: NodeJS.WriteStream;

    protected interactiveManager: InteractiveManager | undefined;

    protected readonly interactive: boolean;

    public constructor(public readonly options: ServerConstructorOptions<T, L>) {
        const { interactive, rawReporter, reporters, stderr, stdout, ...rest } = options;

        super(rest as ConstructorOptions<T, L>);

        this.interactive = interactive ?? false;

        this.stdout = stdout;
        this.stderr = stderr;

        if (this.interactive) {
            this.interactiveManager = new InteractiveManager(new InteractiveStreamHook(this.stdout), new InteractiveStreamHook(this.stderr));
        }

        if (Array.isArray(reporters)) {
            this.registerReporters(reporters);
        }

        this.rawReporter = this.extendReporter(options.rawReporter ?? new RawReporter<L>());
    }

    // @ts-expect-error - this returns a different type
    public override scope<N extends string = T>(...name: string[]): PailServerType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        this.scopeName = name.flat();

        return this as unknown as PailServerType<N, L>;
    }

    public getInteractiveManager(): InteractiveManager | undefined {
        return this.interactiveManager;
    }

    public wrapStd() {
        this._wrapStream(this.stdout, "log");
        this._wrapStream(this.stderr, "log");
    }

    public restoreStd() {
        this._restoreStream(this.stdout);
        this._restoreStream(this.stderr);
    }

    public wrapAll(): void {
        this.wrapConsole();
        this.wrapStd();
    }

    public restoreAll(): void {
        this.restoreConsole();
        this.restoreStd();
    }

    public override clear(): void {
        this.stdout.write(clearTerminal as string);
        this.stderr.write(clearTerminal as string);
    }

    protected override extendReporter(reporter: Reporter<L>): Reporter<L> {
        if (typeof (reporter as StreamAwareReporter<L>).setStdout === "function") {
            (reporter as StreamAwareReporter<L>).setStdout(this.stdout);
        }

        if (typeof (reporter as StreamAwareReporter<L>).setStderr === "function") {
            (reporter as StreamAwareReporter<L>).setStderr(this.stderr);
        }

        if (typeof (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes === "function") {
            (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this.types);
        }

        if (typeof (reporter as StringifyAwareReporter<L>).setStringify === "function") {
            (reporter as StringifyAwareReporter<L>).setStringify(this.stringify);
        }

        if (typeof (reporter as InteractiveStreamReporter<L>).setIsInteractive === "function") {
            (reporter as InteractiveStreamReporter<L>).setIsInteractive(this.interactive);
        }

        if (this.interactive && typeof (reporter as InteractiveStreamReporter<L>).setInteractiveManager === "function") {
            (reporter as InteractiveStreamReporter<L>).setInteractiveManager(this.interactiveManager);
        }

        return reporter;
    }

    private _wrapStream(stream: NodeJS.WriteStream | undefined, type: LiteralUnion<DefaultLogTypes, L>) {
        if (!stream) {
            return;
        }

        // Backup original value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
            (stream as any).__write = stream.write;
        }

        // Override
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
        (stream as any).write = (data: any): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line security/detect-object-injection
            (this as unknown as PailServerImpl)[type](String(data).trim());
        };
    }

    // eslint-disable-next-line class-methods-use-this
    private _restoreStream(stream?: NodeJS.WriteStream): void {
        if (!stream) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
            stream.write = (stream as any).__write;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
            delete (stream as any).__write;
        }
    }
}

export type PailServerType<T extends string = string, L extends string = string> = (new<TC extends string = string, LC extends string = string>(options?: ServerConstructorOptions<TC, LC>) => PailServerType<TC, LC>)
    & PailServerImpl<T, L>
    & Record<DefaultLogTypes, LoggerFunction>
    & Record<T, LoggerFunction>;

export type PailConstructor<T extends string = string, L extends string = string> = new (options?: ServerConstructorOptions<T, L>) => PailServerType<T, L>;

export const PailServer = PailServerImpl as unknown as PailServerType;
