import type { ParseInput, ParseReturnType, ZodTypeDef } from "zod";
import { addIssueToContext, INVALID, ZodIssueCode, ZodParsedType, ZodType } from "zod";

const zodDateInKind = "ZodDateIn";

// simple regex for ISO date, supports the following formats:
// 2021-01-01T00:00:00.000Z
// 2021-01-01T00:00:00Z
// 2021-01-01T00:00:00
// 2021-01-01
// eslint-disable-next-line security/detect-unsafe-regex
export const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?Z?$/;

// eslint-disable-next-line unicorn/prevent-abbreviations
export interface ZodDateInDef extends ZodTypeDef {
    typeName: typeof zodDateInKind;
}

export class ZodDateIn extends ZodType<Date, ZodDateInDef, string> {
    public static create = (): ZodDateIn =>
        new ZodDateIn({
            typeName: zodDateInKind,
        });

    // eslint-disable-next-line no-underscore-dangle
    public _parse(input: ParseInput): ParseReturnType<Date> {
        // eslint-disable-next-line no-underscore-dangle
        const { ctx, status } = this._processInputParams(input);

        if (ctx.parsedType !== ZodParsedType.string) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.string,
                received: ctx.parsedType,
            });

            return INVALID;
        }

        if (!isoDateRegex.test(ctx.data as string)) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "regex",
            });
            status.dirty();
        }

        const date = new Date(ctx.data as string);

        if (Number.isNaN(date.getTime())) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date,
            });

            return INVALID;
        }

        return { status: status.value, value: date };
    }
}
