import { z } from "zod";

export type ZodDateOut = z.ZodType<string, Date>;

const schema: ZodDateOut = z
    .date()
    .refine((value) => !Number.isNaN(value.getTime()), { message: "Invalid date" })
    .transform((value) => value.toISOString());

export const zodDateOut = (): ZodDateOut => schema;
