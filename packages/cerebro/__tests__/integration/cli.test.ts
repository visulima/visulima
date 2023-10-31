import { afterAll,afterEach, describe, expect, it, vi } from "vitest";
import { mockConsole } from "vitest-console";

import { run as cli } from "../../__fixtures__/cli";

const { clearConsole, restoreConsole } = mockConsole();


describe.todo("cli", () => {
    afterEach(clearConsole);

    afterAll(restoreConsole);

    it("should run the cli", async () => {
        await cli();

        expect(console.log).toHaveBeenCalledWith("cerebro version");

    });
});
