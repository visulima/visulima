import { describe, expect, it } from "vitest";

import { ErrorMap } from "../../src/utils/errors";
import type { HttpError, ValidatorConfig } from "../../src/utils/types";
import { Validator } from "../../src/utils/validator";

describe("utils", () => {
    describe(Validator, () => {
        const validator = new Validator();

        const size: Required<ValidatorConfig<{ size: number }>> = {
            isValid(file) {
                return file.size <= this.value;
            },
            response: ErrorMap.RequestEntityTooLarge as HttpError,
            value: 100,
        };

        it("should validate files and throw error for files exceeding size limit", async () => {
            expect.assertions(1);

            validator.add({ size });

            await expect(
                validator.verify({
                    size: 150,
                }),
            ).rejects.toThrow("Request entity too large");
        });
    });
});
