import { stderr, stdout } from "node:process";

import type { stringify } from "safe-stable-stringify";

import type InteractiveManager from "../../interactive/interactive-manager";
import type { ReadonlyMeta, StreamAwareReporter, StringifyAwareReporter } from "../../types";
import writeStream from "../../utils/write-stream";

class RawReporter<L extends string = never> implements StreamAwareReporter<L>, StringifyAwareReporter<L> {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    #stringify: typeof stringify | undefined;

    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    #interactiveManager: InteractiveManager | undefined;

    #interactive = false;

    public constructor() {
        this.#stdout = stdout;
        this.#stderr = stderr;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout_: NodeJS.WriteStream) {
        this.#stdout = stdout_;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr_: NodeJS.WriteStream) {
        this.#stderr = stderr_;
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
        const groupSpaces: string = groups.map(() => "    ").join("");

        if (this.#interactive && this.#interactiveManager !== undefined && stream.isTTY) {
            this.#interactiveManager.update(streamType, (groupSpaces + items.join("")).split("\n"), 0);
        } else {
            writeStream(groupSpaces + items.join(""), stream);
        }
    }
}

export default RawReporter;
