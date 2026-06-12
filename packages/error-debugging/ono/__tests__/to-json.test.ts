import { afterEach, describe, expect, it, vi } from "vitest";

import { clearFileSourceCache } from "../../../../shared/utils/get-file-source";
import { Ono, renderJson } from "../src/index";
import toJSON from "../src/to-json";

describe(toJSON, () => {
    it("should produce a structured payload with name, message and frames", async () => {
        expect.assertions(4);

        const error = new Error("Boom");
        const payload = await toJSON(error);

        expect(payload.stack).toHaveLength(1);
        expect(payload.stack[0]?.name).toBe("Error");
        expect(payload.stack[0]?.message).toBe("Boom");
        expect(Array.isArray(payload.stack[0]?.frames)).toBe(true);
    });

    it("should coerce non-Error values to an Error", async () => {
        expect.assertions(2);

        const payload = await toJSON("just a string");

        expect(payload.stack[0]?.name).toBe("Error");
        expect(payload.stack[0]?.message).toBe("just a string");
    });

    it("should include the full cause chain, outermost first", async () => {
        expect.assertions(3);

        const root = new Error("root cause");
        const wrapper = new Error("wrapper", { cause: root });

        const payload = await toJSON(wrapper);

        expect(payload.stack).toHaveLength(2);
        expect(payload.stack[0]?.message).toBe("wrapper");
        expect(payload.stack[1]?.message).toBe("root cause");
    });

    it("should be JSON-serializable", async () => {
        expect.assertions(1);

        const payload = await toJSON(new Error("serialize me"));

        expect(() => JSON.stringify(payload)).not.toThrow();
    });

    it("should expose a suggested solution when a finder matches", async () => {
        expect.assertions(2);

        const payload = await toJSON(new Error("anything"), {
            solutionFinders: [
                {
                    // eslint-disable-next-line @typescript-eslint/require-await -- finder protocol requires an async handle
                    handle: async () => {
                        return { body: "do the thing", header: "Custom" };
                    },
                    name: "custom",
                    priority: 1000,
                },
            ],
        });

        expect(payload.solution?.header).toBe("Custom");
        expect(payload.solution?.body).toBe("do the thing");
    });

    describe("ssrf: remote stack-frame URLs", () => {
        afterEach(() => {
            clearFileSourceCache();
            vi.restoreAllMocks();
        });

        it("should not issue an outbound fetch for an http(s) stack-frame path by default", async () => {
            expect.assertions(2);

            const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("export const secret = 1;"));

            // Forge a stack whose top frame points at an attacker-controlled remote URL.
            // Code-frame snippet resolution must NOT fetch it (SSRF), so the snippet stays empty.
            const error = new Error("remote frame");

            error.stack = [
                "Error: remote frame",
                "    at handler (https://169.254.169.254/latest/meta-data:1:1)",
                "    at run (https://attacker.example/payload.js:2:3)",
            ].join("\n");

            const payload = await toJSON(error);

            expect(fetchSpy).not.toHaveBeenCalled();
            // Frames are still parsed; only the network read is suppressed.
            expect(Array.isArray(payload.stack[0]?.frames)).toBe(true);
        });
    });

    it("should be reachable via the renderJson export and the Ono class", async () => {
        expect.assertions(2);

        const fromFunction = await renderJson(new Error("x"));
        const fromClass = await new Ono().toJSON(new Error("x"));

        expect(Array.isArray(fromFunction.stack)).toBe(true);
        expect(fromClass.stack[0]?.message).toBe("x");
    });
});
