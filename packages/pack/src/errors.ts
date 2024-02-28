import { isMainThread, parentPort } from "node:worker_threads";

import { bold, dim, red } from "@visulima/colorize";

export class PrettyError extends Error {
    constructor(message: string) {
        super(message);

        this.name = this.constructor.name;

        if (typeof Error.captureStackTrace === "function") {
            Error.captureStackTrace(this, this.constructor);
        } else {
            this.stack = new Error(message).stack;
        }
    }
}

export function handleError(error: any) {
    if (error.loc) {
        console.error(bold(red(`Error parsing: ${error.loc.file}:${error.loc.line}:${error.loc.column}`)));
    }

    if (error.frame) {
        console.error(red(error.message));
        console.error(dim(error.frame));
    } else if (error instanceof PrettyError) {
        console.error(red(error.message));
    } else {
        console.error(red(error.stack));
    }

    process.exitCode = 1;

    if (!isMainThread && parentPort) {
        parentPort.postMessage("error");
    }
}
