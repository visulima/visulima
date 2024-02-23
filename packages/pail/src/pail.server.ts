import ansiEscapes from "ansi-escapes";
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
    LoggerTypesConfig,
    Reporter,
    ServerConstructorOptions,
    StreamAwareReporter,
    StringifyAwareReporter,
} from "./types";

class PailServerImpl<T extends string = never, L extends string = never> extends PailBrowserImpl<T, L> {
    protected readonly stdout: NodeJS.WriteStream;

    protected readonly stderr: NodeJS.WriteStream;

    protected readonly interactiveStdout: InteractiveStreamHook;

    protected readonly interactiveStderr: InteractiveStreamHook;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    protected interactiveManager: InteractiveManager | undefined;

    protected readonly interactive: boolean;

    public constructor(public readonly options: ServerConstructorOptions<T, L> = {}) {
        const { interactive, reporters = [], stderr, stdout, ...rest } = options;

        super(rest as ConstructorOptions<T, L>);

        this.interactive = interactive ?? false;

        this.stdout = stdout as NodeJS.WriteStream;
        this.stderr = stderr as NodeJS.WriteStream;
        this.interactiveStdout = new InteractiveStreamHook(this.stdout);
        this.interactiveStderr = new InteractiveStreamHook(this.stderr);

        if (this.interactive) {
            this.getInteractiveManager();
        }

        this.registerReporters(reporters as Reporter<L>[]);
    }

    public override clone<N extends string = T>(cloneOptions: ServerConstructorOptions<N, L>): PailServerType<N, L> {
        const PailConstructor = PailServerImpl as unknown as new (options: ServerConstructorOptions<N, L>) => PailServerType<N, L>;

        this.interactiveManager?.unhook(true);

        const newInstance = new PailConstructor({
            disabled: this.disabled,
            interactive: this.interactive,
            logLevel: this.generalLogLevel,
            logLevels: this.customLogLevels,
            processors: [...this.processors],
            reporters: [...this.reporters],
            stderr: this.stderr,
            stdout: this.stdout,
            throttle: this.throttle,
            throttleMin: this.throttleMin,
            types: this.customTypes as LoggerTypesConfig<LiteralUnion<DefaultLogTypes, N>, L>,
            ...cloneOptions,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        newInstance.timersMap = new Map(this.timersMap.entries());
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        newInstance.seqTimers = new Set(this.seqTimers.values());

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
        const newScope = new Set([...this.scopeName, name]);

        return this.scope<N>(...newScope);
    }

    public getInteractiveManager() {
        if (this.interactiveManager) {
            return this.interactiveManager;
        }

        if (this.interactive) {
            this.interactiveManager = new InteractiveManager(this.interactiveStdout, this.interactiveStderr);

            return this.interactiveManager;
        }

        throw new Error("Interactive mode is disabled because you forgot to provide the interactive, stdout or stderr flag.");
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
        this.stdout.write(ansiEscapes.clearTerminal);
        this.stderr.write(ansiEscapes.clearTerminal);
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
    (new <TC extends string = never, LC extends string = never>(options?: ServerConstructorOptions<TC, LC>) => PailServerType<TC, LC>);

export type PailConstructor<T extends string = never, L extends string = never> = new (options?: ServerConstructorOptions<T, L>) => PailServerType<T, L>;

export const PailServer = PailServerImpl as unknown as PailServerType;
