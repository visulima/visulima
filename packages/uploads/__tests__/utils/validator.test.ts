import { describe, expect, it } from "vitest";

import { ErrorMap } from "../../src/utils/errors";
import type { HttpError, ValidatorConfig } from "../../src/utils/types.d";
import Validator from "../../src/utils/validator";

describe("utils", () => {
    describe("validator", () => {
        const validator = new Validator();

        const size: Required<ValidatorConfig<any>> = {
            value: 100,
            isValid(file) {
                return file.size <= this.value;
            },
            response: ErrorMap.RequestEntityTooLarge as HttpError,
        };

        it("should be able to add and verify", async () => {
            validator.add({ size });

            await expect(
                validator.verify({
                    size: 150,
                }),
            ).rejects.toThrowError();
        });
    });
});
