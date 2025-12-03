import type { ParseInput, ParseReturnType, ZodTypeDef } from "zod";
import { addIssueToContext, INVALID, ZodIssueCode, ZodParsedType, ZodType } from "zod";

const zodDateOutKind = "ZodDateOut";

// eslint-disable-next-line unicorn/prevent-abbreviations
export interface ZodDateOutDef extends ZodTypeDef {
    typeName: typeof zodDateOutKind;
}

export class ZodDateOut extends ZodType<string, ZodDateOutDef, Date> {
    public static create = (): ZodDateOut =>
        new ZodDateOut({
            typeName: zodDateOutKind,
        });

    // eslint-disable-next-line no-underscore-dangle
    public _parse(input: ParseInput): ParseReturnType<string> {
        // eslint-disable-next-line no-underscore-dangle
        const { ctx, status } = this._processInputParams(input);

        if (ctx.parsedType !== ZodParsedType.date) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: ZodParsedType.date,
                received: ctx.parsedType,
            });

            return INVALID;
        }

        if (Number.isNaN(ctx.data.getTime())) {
            addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_date,
            });

            return INVALID;
        }

        return { status: status.value, value: (ctx.data as Date).toISOString() };
    }
}
