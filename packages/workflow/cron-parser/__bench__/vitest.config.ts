import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [codspeedPlugin()],
    test: {
        // The competing libraries read the system zone, so pin it for comparable results.
        env: { TZ: "UTC" },
    },
});
