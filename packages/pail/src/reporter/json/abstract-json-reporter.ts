import { configure, stringify } from "safe-stable-stringify";

import type { DefaultLogLevels, Meta, Serializer, SerializerAwareReporter } from "../../types";

export type Options = {
    depthLimit?: number;
    edgeLimit?: number;
    serializers?: Serializer[];
};

export abstract class AbstractJsonReporter<L extends string = never> implements SerializerAwareReporter<L> {
    private readonly _stringifySafe: typeof stringify;

    protected _serializers: Map<string, Serializer>;

    protected constructor(options: Options) {
        this._stringifySafe = configure({
            maximumBreadth: options.edgeLimit ?? 100,
            maximumDepth: options.depthLimit ?? 5,
            strict: true,
        });

        this._serializers = new Map((options.serializers ?? []).map((serializer) => [serializer.name, serializer]));
    }

    public log(meta: Meta<L>) {
        const { type, ...rest } = meta;

        if (rest.label) {
            rest.label = rest.label.trim();
        }

        this._log(
            this._stringifySafe(rest, (_, value: any) => {
                for (const serializer of this._serializers.values()) {
                    if (serializer.isApplicable(value)) {
                        return serializer.serialize(value);
                    }
                }

                return value;
            }) as string,
            type.level,
        );
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

    protected abstract _log(message: string, logLevel: DefaultLogLevels | L): void;
}
