import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { Multipart, Rest, Tus } from "../../../src/handler/http/node";
import MemoryStorage from "../../../src/storage/memory/memory-storage";
import type { Send } from "../../__helpers__/handler/flows";
import { MULTIPART_FLOW_ASSERTIONS, multipartFlow, REST_FLOW_ASSERTIONS, restFlow, TUS_FLOW_ASSERTIONS, tusFlow } from "../../__helpers__/handler/flows";

describe("node handler entry", () => {
    let server: Server | undefined;

    const listen = async (handle: (request: IncomingMessage, response: ServerResponse) => Promise<void>): Promise<Send> => {
        server = createServer((request, response) => {
            void handle(request, response);
        });

        await new Promise<void>((resolve) => {
            server?.listen(0, "127.0.0.1", resolve);
        });

        const { port } = server.address() as AddressInfo;

        return async (path, init) => fetch(`http://127.0.0.1:${String(port)}${path}`, init);
    };

    afterEach(async () => {
        await new Promise((resolve) => {
            server?.close(resolve);
        });
    });

    it("should run the REST flow end to end", async () => {
        expect.assertions(REST_FLOW_ASSERTIONS);

        await restFlow(await listen(new Rest({ storage: new MemoryStorage() }).handle), "/files");
    });

    it("should run the TUS flow end to end", async () => {
        expect.assertions(TUS_FLOW_ASSERTIONS);

        await tusFlow(await listen(new Tus({ storage: new MemoryStorage() }).handle), "/files");
    });

    it("should run the multipart flow end to end", async () => {
        expect.assertions(MULTIPART_FLOW_ASSERTIONS);

        await multipartFlow(await listen(new Multipart({ storage: new MemoryStorage() }).handle), "/files");
    });
});
