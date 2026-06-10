// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCallServer = vi.fn().mockResolvedValue("rpc-result");
const mockRegisterFunction = vi.fn();

vi.mock(import("../../src/rpc/client"), () => {
    return {
        createClientRPCContext: vi.fn(() => {
            return { callServer: mockCallServer, registerFunction: mockRegisterFunction };
        }),
        default: vi.fn(() => {
            return { callServer: mockCallServer, registerFunction: mockRegisterFunction };
        }),
    };
});

const { createClientRPCContext } = await import("../../src/rpc/client");
const { default: createServerHelpers } = await import("../../src/toolbar/helpers");

describe("createServerHelpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns an object with an rpc property", () => {
        expect.hasAssertions();

        const helpers = createServerHelpers();

        expect(helpers).toHaveProperty("rpc");
        expect(helpers.rpc).not.toBeNull();
    });

    it("calls createClientRPCContext once during construction", () => {
        expect.hasAssertions();

        createServerHelpers();

        expect(createClientRPCContext).toHaveBeenCalledTimes(1);
    });

    it("rpc is a Proxy that forwards any method call to callServer", async () => {
        expect.hasAssertions();

        const localCallServer = vi.fn().mockResolvedValue("some-result");

        vi.mocked(createClientRPCContext).mockReturnValueOnce({
            callServer: localCallServer,
            registerFunction: vi.fn(),
        });

        const helpers = createServerHelpers();
        const result = await (helpers.rpc as Record<string, (...args: unknown[]) => unknown>).getViteConfig("arg1", "arg2");

        expect(localCallServer).toHaveBeenCalledWith("getViteConfig", "arg1", "arg2");
        expect(result).toBe("some-result");
    });

    it("rpc Proxy works for any property name (dynamic dispatch)", async () => {
        expect.hasAssertions();

        const localCallServer = vi.fn().mockResolvedValue(42);

        vi.mocked(createClientRPCContext).mockReturnValueOnce({
            callServer: localCallServer,
            registerFunction: vi.fn(),
        });

        const helpers = createServerHelpers();

        await (helpers.rpc as Record<string, (...args: unknown[]) => unknown>).customMethod();

        expect(localCallServer).toHaveBeenCalledWith("customMethod");
    });

    it("each call to createServerHelpers creates a fresh RPC context", () => {
        expect.hasAssertions();

        createServerHelpers();
        createServerHelpers();

        expect(createClientRPCContext).toHaveBeenCalledTimes(2);
    });
});
