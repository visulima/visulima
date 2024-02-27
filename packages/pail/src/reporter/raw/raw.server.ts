import type { stringify } from "safe-stable-stringify";

import type { InteractiveManager } from "../../interactive/interactive-manager";
import type { ReadonlyMeta, StreamAwareReporter, StringifyAwareReporter } from "../../types";
import { writeStream } from "../../util/write-stream";

export class RawReporter<L extends string = never> implements StreamAwareReporter<L>, StringifyAwareReporter<L> {
    #stringify: typeof stringify | undefined;

    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    #interactiveManager: InteractiveManager | undefined;

    #interactive = false;

    public constructor() {
        this.#stdout = process.stdout;
        this.#stderr = process.stderr;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout: NodeJS.WriteStream) {
        this.#stdout = stdout;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr: NodeJS.WriteStream) {
        this.#stderr = stderr;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
    public setStringify(function_: any): void {
        this.#stringify = function_;
    }

    public setInteractiveManager(manager?: InteractiveManager): void {
        this.#interactiveManager = manager;
    }

    public setIsInteractive(interactive: boolean): void {
        this.#interactive = interactive;
    }

    public log(meta: ReadonlyMeta<L>): void {
        const { context, groups, message, type } = meta;

        const items: string[] = [];

        const formattedMessage: string | undefined = typeof message === "string" ? message : (this.#stringify as typeof stringify)(message);

        items.push(formattedMessage + "");

        if (context) {
            items.push(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                ...context.map((value) => {
                    if (typeof value === "object") {
                        return " " + (this.#stringify as typeof stringify)(value);
                    }

                    return " " + value;
                }),
            );
        }

        const streamType = ["error", "trace", "warn"].includes(type.level as string) ? "stderr" : "stdout";
        const stream = streamType === "stderr" ? this.#stderr : this.#stdout;
        const groupSpaces: string = groups ? groups.map(() => "    ").join("") : "";

        if (this.#interactive && this.#interactiveManager !== undefined && stream.isTTY) {
            this.#interactiveManager.update(streamType, (groupSpaces + items.join("")).split("\n"), 0);
        } else {
            writeStream(groupSpaces + items.join(""), stream);
        }
    }
}
