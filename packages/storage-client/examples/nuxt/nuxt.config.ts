import { tmpdir } from "node:os";
import { join } from "node:path";

import { DiskStorage } from "@visulima/storage";
import storageModule from "@visulima/storage/nuxt";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: "2024-04-03",
    devtools: { enabled: true },
    typescript: {
        strict: true,
    },
    modules: [
        [
            storageModule,
            {
                storage: new DiskStorage({
                    directory: join(tmpdir(), "visulima-uploads"),
                }),
                basePath: "/api/upload",
                multipart: true,
                rest: true,
                tus: true,
            },
        ],
    ],
});
