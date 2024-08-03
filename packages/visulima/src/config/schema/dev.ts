    import { z } from "zod";

import isDocker from "../../util/is-docker";
import { isWsl } from "../../util/is-wsl";

const development = z
    .object({
        exclude: z.array(z.string()).default([]),
        headers: z.record(z.string()).default({}),
        host: z
            .union([z.string(), z.literal("false")])
            .optional()
            .default(isDocker() || isWsl() ? "" : process.env["VISULIMA_HOST"] ?? process.env["NITRO_HOST"] ?? process.env["HOST"] ?? "localhost"),
        https: z
            .union([
                z.boolean(),
                z.object({
                    cert: z.string(),
                    key: z.string(),
                }),
            ])
            .default(false),
        open: z.boolean().default(false),
        port: z.number().default(() => {
            if (process.env["VISULIMA_PORT"] || process.env["NITRO_PORT"] || process.env["PORT"]) {
                return Number.parseInt((process.env["VISULIMA_PORT"] ?? process.env["NITRO_PORT"] ?? process.env["PORT"]) as string, 10);
            }

            return 3000;
        }),
        url: z.string().url().default("http://localhost:3000"),
        watchFiles: z.array(z.string()).default([]),
    })
    .default({});

export type DevelopmentSchema = z.infer<typeof development>;
export default development;
