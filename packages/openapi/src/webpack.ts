import type { UnpluginFactoryOutput, WebpackPluginInstance } from "unplugin";
import { createWebpackPlugin } from "unplugin";

import unpluginFactory from "./core/plugin-factory";
import type { Options } from "./core/types";

export default createWebpackPlugin(unpluginFactory) as UnpluginFactoryOutput<Options, WebpackPluginInstance>;
