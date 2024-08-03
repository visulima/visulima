import { z } from "zod";

const nitro = z
    .object({
        autoImport: z.boolean().default(true),
        logLevel: z.number().min(0).max(5).default(3),
        output: z.record(z.unknown()).default({}),
        runtimeConfig: z
            .object({
                apiPrefix: z.string().default("api"),
            })
            .default({}),
    })
    .default({});

export type ReactSchema = z.infer<typeof nitro>;

export default nitro;
