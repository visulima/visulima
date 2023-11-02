import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

import { run as cli } from "../../__fixtures__/cli";

const { clearConsole, restoreConsole } = mockConsole();

describe.todo("cli", () => {
    afterEach(clearConsole);

    afterAll(restoreConsole);

    it("should run the cli", async () => {
        await cli();

        // eslint-disable-next-line no-console
        expect(console.log).toHaveBeenCalledWith("cerebro version");
    });
});
