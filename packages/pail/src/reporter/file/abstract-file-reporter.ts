import type { Options as RfsOptions } from "rotating-file-stream";

import type { Meta, Serializer, SerializerAwareReporter } from "../../types";
import RotatingFileStream from "../../util/rotating-file-stream";

export type Options = RfsOptions & {
    filePath: string;
    serializers?: Serializer[];
    writeImmediately?: boolean;
};

export abstract class AbstractFileReporter<L extends string = never> implements SerializerAwareReporter<L> {
    protected _serializers: Map<string, Serializer>;

    protected _stream: RotatingFileStream;

    protected constructor(options: Options) {
        const { filePath, serializers, writeImmediately = false, ...rfsOptions } = options;

        this._serializers = new Map((serializers ?? []).map((s) => [s.name, s]));
        this._stream = new RotatingFileStream(filePath, writeImmediately, rfsOptions);
    }

    public log(meta: Meta<L>): void {
        this._stream.write(`${this._formatMessage(meta as Meta<L>)}\n`);
    }

    public setSerializers(serializers: Map<string, Serializer>): void {
        // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
        for (const serializer of serializers.values()) {
            if (this._serializers.has(serializer.name)) {
                // eslint-disable-next-line no-console
                console.debug(`Serializer ${serializer.name} already exists, skipping`);
            } else {
                this._serializers.set(serializer.name, serializer);
            }
        }
    }

    protected abstract _formatMessage(data: Meta<L>): string;
}
