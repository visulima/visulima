import { describe, expect, it, vi } from "vitest";

import type { Cli as ICli, Logger as ILogger, Toolbox as IToolbox } from "../../../src/@types";
import versionCommand from "../../../src/command/version";

describe("command/version", () => {
    it("should output the version number when version is defined", async () => {
        expect.assertions(4);

        const loggerMock = {
            debug: vi.fn(),
            info: vi.fn(),
            warning: vi.fn(),
        };
        const runtimeMock = {
            getPackageVersion: vi.fn().mockReturnValue("1.0.0"),
        };

        await versionCommand.execute({ logger: loggerMock as unknown as ILogger, runtime: runtimeMock as unknown as ICli } as IToolbox);

        expect(runtimeMock.getPackageVersion).toHaveBeenCalledExactlyOnceWith();
        expect(loggerMock.info).toHaveBeenCalledExactlyOnceWith("1.0.0");
        expect(loggerMock.warning).not.toHaveBeenCalled();
        expect(loggerMock.debug).not.toHaveBeenCalled();
    });

    it("should warn and debug when version is undefined", async () => {
        expect.assertions(4);

        const loggerMock = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
        };
        const runtimeMock = {
            getPackageVersion: vi.fn().mockReturnValue(undefined),
        };

        await versionCommand.execute({ logger: loggerMock as unknown as ILogger, runtime: runtimeMock as unknown as ICli } as IToolbox);

        expect(runtimeMock.getPackageVersion).toHaveBeenCalledExactlyOnceWith();
        expect(loggerMock.warn).toHaveBeenCalledExactlyOnceWith("Unknown version");
        expect(loggerMock.debug).toHaveBeenCalledExactlyOnceWith("The version number was not provided by the cli constructor.");
        expect(loggerMock.info).not.toHaveBeenCalled();
    });
});
