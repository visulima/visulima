import { fileURLToPath, pathToFileURL } from "node:url";

import type { TsConfigResult } from "@visulima/tsconfig";
import { findTsConfig } from "@visulima/tsconfig";
import type { LoadConfigOptions } from "c12";
import { loadConfig } from "c12";
import { fromZodError } from "zod-validation-error";

import type { InternalVisulimaConfig, VisulimaConfig } from "./schema";
import { internalVisulimaSchema } from "./schema";
import package_ from "../../package.json";

const index = async (options: LoadVisulimaConfigOptions): Promise<InternalVisulimaConfig> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-return
    (globalThis as any).defineVisulimaConfig = (c: any) => c;

    const result = await loadConfig<VisulimaConfig>({
        configFile: "visulima.config",
        dotenv: true,
        extend: { extendKey: ["extends"] },
        globalRc: true,
        name: "visulima",
        rcFile: ".visulimarc",
        ...options,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).defineVisulimaConfig;

    const { configFile, cwd } = result;
    const visulimaConfig = result.config as InternalVisulimaConfig;

    // Fill config
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    visulimaConfig.rootDir = visulimaConfig.rootDir ?? cwd;
    // eslint-disable-next-line no-underscore-dangle
    visulimaConfig._visulimaConfigFile = configFile;
    // eslint-disable-next-line no-underscore-dangle
    visulimaConfig._visulimaConfigFiles = [configFile];
    // eslint-disable-next-line no-underscore-dangle
    visulimaConfig._visulimaVersion = package_.version;

    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    let tsconfig: TsConfigResult | undefined;

    try {
        tsconfig = await findTsConfig(cwd);
    } catch {
        /* empty */
    }

    if (tsconfig) {
        const { config: tsconfigConfig, path: tsconfigPath } = tsconfig as TsConfigResult;

        // eslint-disable-next-line no-underscore-dangle
        visulimaConfig._tsconfig = tsconfigConfig;
        // eslint-disable-next-line no-underscore-dangle
        visulimaConfig._tsconfigPath = tsconfigPath;
    }

    try {
        const parsedConfig = internalVisulimaSchema.parse(visulimaConfig);
        const watchFiles = new Set<string>(parsedConfig.devServer.watchFiles);

        if (configFile) {
            watchFiles.add(configFile);
        }

        if (cwd) {
            watchFiles.add(fileURLToPath(new URL("package.json", pathToFileURL(cwd))));
        }

        // eslint-disable-next-line no-underscore-dangle
        if (parsedConfig._tsconfigPath) {
            // eslint-disable-next-line no-underscore-dangle
            watchFiles.add(parsedConfig._tsconfigPath);
        }

        parsedConfig.devServer.watchFiles = [...watchFiles];

        return parsedConfig;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        throw fromZodError(error);
    }
};

export type LoadVisulimaConfigOptions = LoadConfigOptions<VisulimaConfig>;
export default index;
