import { createRollupPlugin } from "unplugin";
import unpluginFactory from "./generator/unplugin-factory";

export default createRollupPlugin(unpluginFactory);
