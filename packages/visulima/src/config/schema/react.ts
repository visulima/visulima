import { z } from "zod";

const react = z
    .object({
        babel: z
            .record(z.unknown())
            .or(
                z
                    .function()
                    .args(z.string(), z.object({ ssr: z.boolean().optional() }))
                    .returns(z.record(z.unknown())),
            )
            .default({}),
        strictMode: z.boolean().default(true)
    })
    .default({});

export type ReactSchema = z.infer<typeof react>;

export default react;
