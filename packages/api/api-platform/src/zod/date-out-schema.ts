// eslint-disable-next-line import/no-namespace -- zod v3's CJS-style export shape requires namespace import to access the runtime z.* values used below
import * as z from "zod";

const zodDateOutKind = "ZodDateOut";

// eslint-disable-next-line unicorn/prevent-abbreviations
export interface ZodDateOutDef extends z.ZodTypeDef {
    typeName: typeof zodDateOutKind;
}

export class ZodDateOut extends z.ZodType<string, ZodDateOutDef, Date> {
    public static readonly create = (): ZodDateOut =>
        new ZodDateOut({
            typeName: zodDateOutKind,
        });

    // eslint-disable-next-line no-underscore-dangle
    public _parse(input: z.ParseInput): z.ParseReturnType<string> {
        // eslint-disable-next-line no-underscore-dangle
        const { ctx, status } = this._processInputParams(input);

        if (ctx.parsedType !== z.ZodParsedType.date) {
            z.addIssueToContext(ctx, {
                code: z.ZodIssueCode.invalid_type,
                expected: z.ZodParsedType.date,
                received: ctx.parsedType,
            });

            return z.INVALID;
        }

        if (Number.isNaN((ctx.data as Date).getTime())) {
            z.addIssueToContext(ctx, {
                code: z.ZodIssueCode.invalid_date,
            });

            return z.INVALID;
        }

        return { status: status.value, value: (ctx.data as Date).toISOString() };
    }
}
