import { createEsbuildPlugin } from "unplugin";
import unpluginFactory from "./core/plugin-factory";

export default createEsbuildPlugin(unpluginFactory);
