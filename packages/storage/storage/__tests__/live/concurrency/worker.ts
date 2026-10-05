/**
 * A separate Node process over a shared bucket or container, driven by the concurrency suite over
 * IPC. It is bundled by esbuild before it is forked, so it imports no vitest.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";

import { Files, UploadControl } from "../../../src/files";
import { Rest, Tus } from "../../../src/handler/http/node";
import type { LiveTarget } from "./storages";
import { createLiveStorage, PART_SIZE, pattern } from "./storages";

export type WorkerCommand =
    | { ifNoneMatch?: "*"; key: string; op: "upload"; seed: number; size: number }
    | { key: string; op: "resume"; size: number; token: string }
    | { key: string; op: "start-and-die"; size: number }
    | { op: "purge" }
    | { op: "serve" };

export type WorkerReply = { error: { code?: string; message: string }; ok: false } | { ok: true; result: unknown };

const storage = createLiveStorage(JSON.parse(process.env.LIVE_TARGET as string) as LiveTarget);
const files = new Files({ adapter: storage });

const listen = async (handle: (request: IncomingMessage, response: ServerResponse) => Promise<void>): Promise<number> => {
    const server = createServer((request, response) => {
        void handle(request, response);
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });

    return (server.address() as AddressInfo).port;
};

/** Bytes handed to the adapter's `write`, to tell a resume that re-sends stored bytes from one that doesn't. */
let bytesWritten = 0;
const write = storage.write.bind(storage);

storage.write = async (part, ...rest) => {
    bytesWritten += (part as { contentLength?: number }).contentLength ?? 0;

    return write(part, ...rest);
};

const run = async (command: WorkerCommand): Promise<unknown> => {
    switch (command.op) {
        case "purge": {
            const { items } = await storage.purge();

            return items.map((item) => item.id);
        }
        case "resume": {
            await files.upload(command.key, pattern(command.size), { control: UploadControl.from(command.token), multipart: { partSize: PART_SIZE } });

            return { bytesWritten };
        }
        case "serve": {
            return { rest: await listen(new Rest({ storage }).handle), tus: await listen(new Tus({ storage }).handle) };
        }
        case "start-and-die": {
            // Stores the first part, reports the resume token, then hangs until the suite kills it.
            const control = new UploadControl();
            const source = pattern(command.size);
            const body = Readable.from(
                (async function* firstPartOnly() {
                    yield source.subarray(0, PART_SIZE);
                    await new Promise(() => {});
                })(),
            );

            void files.upload(command.key, body, {
                control,
                multipart: { partSize: PART_SIZE },
                onProgress: ({ loaded }) => {
                    if (loaded >= PART_SIZE) {
                        process.send?.({ ok: true, result: JSON.stringify(control) } satisfies WorkerReply);
                    }
                },
                size: command.size,
            });

            return new Promise(() => {});
        }
        case "upload": {
            const { etag } = await files.upload(command.key, pattern(command.size, command.seed), { ifNoneMatch: command.ifNoneMatch });

            return { etag };
        }
        default: {
            throw new Error("unknown command");
        }
    }
};

process.on("message", (command: WorkerCommand) => {
    run(command).then(
        (result) => process.send?.({ ok: true, result } satisfies WorkerReply),
        (error: unknown) => {
            const { message, UploadErrorCode: code } = error as { message: string; UploadErrorCode?: string };

            process.send?.({ error: { code, message }, ok: false } satisfies WorkerReply);
        },
    );
});
