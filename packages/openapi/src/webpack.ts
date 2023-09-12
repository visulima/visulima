import type { UnpluginFactoryOutput, WebpackPluginInstance } from "unplugin";
import { createWebpackPlugin } from "unplugin";

import unpluginFactory from "./generator/unplugin-factory";
import type { Options } from "./generator/types";

export default createWebpackPlugin(unpluginFactory) as UnpluginFactoryOutput<Options, WebpackPluginInstance>;
