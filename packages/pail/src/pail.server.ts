import { InteractiveManager } from "./interactive/interactive-manager";
import { InteractiveStreamHook } from "./interactive/interactive-stream-hook";
import { PailBrowserImpl } from "./pail.browser";
import type {
    ConstructorOptions,
    DefaultLogTypes,
    LoggerFunction,
    LoggerTypesAwareReporter,
    LoggerTypesConfig,
    ServerConstructorOptions,
    StreamAwareReporter,
    StringifyAwareReporter,
} from "./types";

class PailServerImpl<T extends string = never, L extends string = never> extends PailBrowserImpl<T, L> {
    protected readonly _stdout: NodeJS.WriteStream | undefined;

    protected readonly _stderr: NodeJS.WriteStream | undefined;

    protected readonly _interactiveStdout: InteractiveStreamHook | undefined;

    protected readonly _interactiveStderr: InteractiveStreamHook | undefined;

    protected _interactiveManager: InteractiveManager | undefined;

    protected readonly _interactive: boolean;

    public constructor(public readonly options: ServerConstructorOptions<T, L> = {}) {
        const { interactive, reporters, stderr, stdout, ...rest } = options;

        super(rest as ConstructorOptions<T, L>);

        this._interactive = interactive ?? false;

        this._stdout = stdout;
        this._stderr = stderr;

        if (this._interactive && stdout && stderr) {
            this._interactiveStdout = new InteractiveStreamHook(stdout);
            this._interactiveStderr = new InteractiveStreamHook(stderr);
        }

        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const reporter of reporters ?? []) {
             
            if (this._stdout && (reporter as StreamAwareReporter<L>).setStdout) {
                (reporter as StreamAwareReporter<L>).setStdout(this._stdout);
            }

             
            if (this._stderr && (reporter as StreamAwareReporter<L>).setStderr) {
                (reporter as StreamAwareReporter<L>).setStderr(this._stderr);
            }

             
            if ((reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes) {
                (reporter as LoggerTypesAwareReporter<T, L>).setLoggerTypes(this._types);
            }

             
            if ((reporter as StringifyAwareReporter<L>).setStringify) {
                (reporter as StringifyAwareReporter<L>).setStringify(this._stringify);
            }

            this._reporters.add(reporter);
        }
    }

    public override clone<N extends string = T>(cloneOptions: ServerConstructorOptions<N, L>): PailServerType<N, L> {
        const PailConstructor = PailServerImpl as unknown as new (options: ServerConstructorOptions<N, L>) => PailServerType<N, L>;

        const newInstance = new PailConstructor({
            disabled: this._disabled,
            interactive: this._interactive,
            logLevel: this._generalLogLevel,
            logLevels: this._customLogLevels,
            processors: [...this._processors],
            reporters: [...this._reporters],
            stderr: this._stderr,
            stdout: this._stdout,
            throttle: this._throttle,
            throttleMin: this._throttleMin,
            types: this._customTypes as LoggerTypesConfig<N, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>,
            ...cloneOptions,
        });

        newInstance.timers = new Map(this.timers.entries());
        newInstance.seqTimers = [...this.seqTimers];

        return newInstance;
    }

    public override scope<N extends string = T>(...name: string[]): PailServerType<N, L> {
        if (name.length === 0) {
            throw new Error("No scope name was defined.");
        }

        return this.clone<N>({
            scope: name.flat(),
        });
    }

    public override child<N extends string = T>(name: string): PailServerType<N, L> {
        const newScope = new Set([...this._scopeName, name]);

        return this.scope<N>(...newScope);
    }

    public getInteractiveManager() {
        if (this._interactiveManager) {
            return this._interactiveManager;
        }

        if (this._interactive && this._interactiveStdout && this._interactiveStderr) {
            this._interactiveManager = new InteractiveManager(this._interactiveStdout, this._interactiveStderr);

            return this._interactiveManager;
        }

        throw new Error("Interactive mode is disabled because you forgot to provide the interactive, stdout or stderr flag.");
    }

    public wrapStd() {
        this._wrapStream(this._stdout, "log");
        this._wrapStream(this._stderr, "log");
    }

    public restoreStd() {
        this._restoreStream(this._stdout);
        this._restoreStream(this._stderr);
    }

    public wrapAll(): void {
        this.wrapConsole();
        this.wrapStd();
    }

    public restoreAll(): void {
        this.restoreConsole();
        this.restoreStd();
    }

    private _wrapStream(stream: NodeJS.WriteStream | undefined, type: DefaultLogTypes | L) {
        if (!stream) {
            return;
        }

        // Backup original value
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
        if (!(stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign,@typescript-eslint/unbound-method
            (stream as any).__write = stream.write;
        }

        // Override
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign
        (stream as any).write = (data: any): void => {
            // @TODO: Fix typings
            // @ts-expect-error - dynamic property
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,security/detect-object-injection
            (this as unknown as PailServerImpl)[type].log(String(data).trim());
        };
    }

    // eslint-disable-next-line class-methods-use-this
    private _restoreStream(stream?: NodeJS.WriteStream): void {
        if (!stream) {
            return;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any
        if ((stream as any).__write) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign,@typescript-eslint/no-unsafe-assignment
            stream.write = (stream as any).__write;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-explicit-any,no-param-reassign
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
