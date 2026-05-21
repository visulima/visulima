import * as z from "zod";

// simple regex for ISO date, supports the following formats:
// 2021-01-01T00:00:00.000Z
// 2021-01-01T00:00:00Z
// 2021-01-01T00:00:00
// 2021-01-01
export const isoDateRegex: RegExp = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?)?Z?$/;

export type ZodDateIn = z.ZodType<Date, string>;

const schema: ZodDateIn = z
    .string()
    .trim()
    .regex(isoDateRegex)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), { error: "Invalid date" })
    .transform((value) => new Date(value));

export const zodDateIn = (): ZodDateIn => schema;
