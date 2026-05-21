// eslint-disable-next-line import/no-namespace -- zod/consistent-import requires a namespace import for Zod.
import * as z from "zod";

type ZodDateOut = z.ZodType<string, Date>;

const dateOutSchema: ZodDateOut = z
    .date()
    .refine((value) => !Number.isNaN(value.getTime()), { error: "Invalid date" })
    .transform((value) => value.toISOString());

const zodDateOut = (): ZodDateOut => dateOutSchema;

export { type ZodDateOut, zodDateOut };
