import { describe, it, expect } from "vitest";

import { run as cli } from "../__fixtures__/cli";

describe("cli", () => {
    it("should run the cli", async () => {
        await cli();

        // @TDOD: Add assertions with console output
    });
});
