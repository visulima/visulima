import { describe, expect, it } from "vitest";

import { run as cli } from "../../__fixtures__/cli";

describe.todo("cli", () => {
    it("should run the cli", async () => {
        await cli();

        // eslint-disable-next-line no-console
        expect(console.log).toHaveBeenCalledWith("cerebro version");
    });
});
