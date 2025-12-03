import { describe, expect, it, vi } from "vitest";

import versionCommand from "../../../src/commands/version-command";
import type { Toolbox as IToolbox } from "../../../src/types/toolbox";

describe("command/version", () => {
    it("should output the version number when version is defined", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
        };
        const runtimeMock = {
            getPackageVersion: vi.fn().mockReturnValue("1.0.0"),
        };

        await versionCommand.execute({ logger: loggerMock, runtime: runtimeMock });

        expect(runtimeMock.getPackageVersion).toHaveBeenCalledExactlyOnceWith();
        expect(loggerMock).toMatchSnapshot();
    });

    it("should warn and debug when version is undefined", async () => {
        expect.assertions(2);

        const loggerMock = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };
        const runtimeMock = {
            getPackageVersion: vi.fn().mockReturnValue(undefined),
        };

        await versionCommand.execute({ logger: loggerMock, runtime: runtimeMock } as IToolbox);

        expect(runtimeMock.getPackageVersion).toHaveBeenCalledExactlyOnceWith();
        expect(loggerMock).toMatchSnapshot();
    });
});
