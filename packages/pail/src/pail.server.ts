import type { LiteralUnion } from "type-fest";

import { InteractiveManager } from "./interactive/interactive-manager";
import { InteractiveStreamHook } from "./interactive/interactive-stream-hook";
import { PailBrowserImpl } from "./pail.browser";
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
import { clearTerminal } from "./util/ansi-escapes";

class PailServerImpl<T extends string = never, L extends string = never> extends PailBrowserImpl<T, L> {
    protected readonly stdout: NodeJS.WriteStream;

    protected readonly stderr: NodeJS.WriteStream;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    protected interactiveManager: InteractiveManager | undefined;

    protected readonly interactive: boolean;

    public constructor(public readonly options: ServerConstructorOptions<T, L> = {}) {
        const { interactive, reporters, stderr, stdout, ...rest } = options;

        super(rest as ConstructorOptions<T, L>);

        this.interactive = interactive ?? false;

        this.stdout = stdout as NodeJS.WriteStream;
        this.stderr = stderr as NodeJS.WriteStream;

        if (this.interactive) {
            this.interactiveManager = new InteractiveManager(new InteractiveStreamHook(this.stdout), new InteractiveStreamHook(this.stderr));
        }

        if (Array.isArray(reporters)) {
            this.registerReporters(reporters);
        }
    }

    public override scope<N extends string = T>(...name: string[]): PailServerType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        this.scopeName = name.flat();

        return this as unknown as PailServerType<N, L>;
    }

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
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

    protected override registerReporters(reporters: Reporter<L>[]): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of reporters) {
            if ((reporter as StreamAwareReporter<L>).setStdout) {
                (reporter as StreamAwareReporter<L>).setStdout(this.stdout);
            }

            if ((reporter as StreamAwareReporter<L>).setStderr) {
                (reporter as StreamAwareReporter<L>).setStderr(this.stderr);
            }

            if ((reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes) {
                (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this.types);
            }

            if ((reporter as StringifyAwareReporter<L>).setStringify) {
                (reporter as StringifyAwareReporter<L>).setStringify(this.stringify);
            }

            if ((reporter as InteractiveStreamReporter<L>).setIsInteractive) {
                (reporter as InteractiveStreamReporter<L>).setIsInteractive(this.interactive);
            }

            if (this.interactive && (reporter as InteractiveStreamReporter<L>).setInteractiveManager) {
                (reporter as InteractiveStreamReporter<L>).setInteractiveManager(this.interactiveManager);
            }

            this.reporters.add(reporter);
        }
    }

    private _wrapStream(stream: NodeJS.WriteStream | undefined, type: LiteralUnion<DefaultLogTypes, L>) {
        if (!stream) {
            return;
        }

        // Backup original value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign,@typescript-eslint/unbound-method
            (stream as any).__write = stream.write;
        }

        // Override
        // eslint-disable-next-line @typescript-eslint/no-explicit-any,no-param-reassign
        (stream as any).write = (data: any): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line security/detect-object-injection
            (this as unknown as PailServerImpl)[type].log(String(data).trim());
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

export type PailServerType<T extends string = never, L extends string = never> = PailServerImpl<T, L> &
    Record<DefaultLogTypes, LoggerFunction> &
    Record<T, LoggerFunction> &
    (new<TC extends string = never, LC extends string = never>(options?: ServerConstructorOptions<TC, LC>) => PailServerType<TC, LC>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ServerConstructorOptions<T, L>) => PailServerType<T, L>;

export const PailServer = PailServerImpl as unknown as PailServerType;
