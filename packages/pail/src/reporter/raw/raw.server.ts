import { stderr, stdout } from "node:process";

import type { Options as InspectorOptions } from "@visulima/inspector";
import { inspect } from "@visulima/inspector";

import { EMPTY_SYMBOL } from "../../constants";
import type InteractiveManager from "../../interactive/interactive-manager";
import type { ReadonlyMeta, StreamAwareReporter } from "../../types";
import writeStream from "../../utils/write-stream";

class RawReporter<L extends string = string> implements StreamAwareReporter<L> {
    #stdout: NodeJS.WriteStream;

    #stderr: NodeJS.WriteStream;

    #interactiveManager: InteractiveManager | undefined;

    #interactive = false;

    readonly #inspectOptions: Partial<InspectorOptions>;

    public constructor(inspectOptions: Partial<InspectorOptions> = {}) {
        this.#stdout = stdout;
        this.#stderr = stderr;
        this.#inspectOptions = inspectOptions;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStdout(stdout_: NodeJS.WriteStream) {
        this.#stdout = stdout_;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public setStderr(stderr_: NodeJS.WriteStream) {
        this.#stderr = stderr_;
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

        if (message !== EMPTY_SYMBOL) {
            const formattedMessage: string = typeof message === "string" ? message : inspect(message, this.#inspectOptions);

            items.push(formattedMessage);
        }

        if (context) {
            items.push(
                ...context.map((value) => {
                    if (typeof value === "object") {
                        return ` ${inspect(value, this.#inspectOptions)}`;
                    }

                    return ` ${value}`;
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
