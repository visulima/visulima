import loggerTypes from "../../logger-types";
import type { DefaultLogLevels, DefaultLogTypes, LoggerTypesConfig, Meta, SerializerAwareReporter, LoggerTypesAwareReporter, Serializer } from "../../types";

export abstract class AbstractPrettyReporter<T extends string = never, L extends string = never>
    implements SerializerAwareReporter<L>, LoggerTypesAwareReporter<T, L>
{
    protected readonly _styles: PrettyStyleOptions;

    protected _loggerTypes: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;

    protected _serializers: Map<string, Serializer>;

    protected constructor(
        options: Partial<
            PrettyStyleOptions & {
                serializers?: Serializer[];
            }
        >,
    ) {
        this._styles = {
            bold: {
                label: false,
            },
            dateFormatter: (date: Date) => date.toISOString(),
            underline: {
                label: false,
                message: false,
                prefix: false,
                suffix: false,
            },
            uppercase: {
                label: false,
            },
            ...options,
        } as PrettyStyleOptions;

        this._loggerTypes = loggerTypes as LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>;
        this._serializers = new Map((options.serializers ?? []).map((serializer) => [serializer.name, serializer]));
    }

    public setLoggerTypes(types: LoggerTypesConfig<T, L> & Partial<LoggerTypesConfig<DefaultLogTypes, L>>) {
        this._loggerTypes = types;
    }

    public log(meta: Meta<L>) {
        this._log(this._formatMessage(meta as Meta<L>), meta.type.level);
    }

    public setSerializers(serializers: Map<string, Serializer>): void {
        for (const serializer of [...serializers.values()]) {
            if (this._serializers.has(serializer.name)) {
                console.debug(`Serializer ${serializer.name} already exists, skipping`);
            } else {
                this._serializers.set(serializer.name, serializer);
            }
        }
    }

    protected abstract _formatMessage(data: Meta<L>): string;

    protected abstract _log(message: string, logLevel: DefaultLogLevels | L): void;

    protected abstract _formatError(error: Error, size: number): string;
}

export type PrettyStyleOptions = {
    bold: {
        label: boolean;
    };
    dateFormatter: (date: Date) => string;
    // Length of the message before a line break is inserted
    messageLength: number | undefined;
    underline: {
        label: boolean;
        prefix: boolean;
        suffix: boolean;
    };
    uppercase: {
        label: boolean;
    };
};
