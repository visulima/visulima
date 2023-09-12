import { createRollupPlugin } from "unplugin";
import unpluginFactory from "./core/plugin-factory";

export default createRollupPlugin(unpluginFactory);
