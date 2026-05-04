// eslint-disable-next-line import/no-namespace -- zod v3's CJS-style export shape requires namespace import to access the runtime z.* values used below
import * as z from "zod";

const zodDateInKind = "ZodDateIn";

// simple regex for ISO date, supports the following formats:
// 2021-01-01T00:00:00.000Z
// 2021-01-01T00:00:00Z
// 2021-01-01T00:00:00
// 2021-01-01
export const isoDateRegex: RegExp = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?Z?$/;

// eslint-disable-next-line unicorn/prevent-abbreviations
export interface ZodDateInDef extends z.ZodTypeDef {
    typeName: typeof zodDateInKind;
}

export class ZodDateIn extends z.ZodType<Date, ZodDateInDef, string> {
    public static readonly create = (): ZodDateIn =>
        new ZodDateIn({
            typeName: zodDateInKind,
        });

    // eslint-disable-next-line no-underscore-dangle
    public _parse(input: z.ParseInput): z.ParseReturnType<Date> {
        // eslint-disable-next-line no-underscore-dangle
        const { ctx, status } = this._processInputParams(input);

        if (ctx.parsedType !== z.ZodParsedType.string) {
            z.addIssueToContext(ctx, {
                code: z.ZodIssueCode.invalid_type,
                expected: z.ZodParsedType.string,
                received: ctx.parsedType,
            });

            return z.INVALID;
        }

        if (!isoDateRegex.test(ctx.data as string)) {
            z.addIssueToContext(ctx, {
                code: z.ZodIssueCode.invalid_string,
                validation: "regex",
            });
            status.dirty();
        }

        const date = new Date(ctx.data as string);

        if (Number.isNaN(date.getTime())) {
            z.addIssueToContext(ctx, {
                code: z.ZodIssueCode.invalid_date,
            });

            return z.INVALID;
        }

        return { status: status.value, value: date };
    }
}
