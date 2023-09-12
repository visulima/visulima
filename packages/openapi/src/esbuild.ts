import { createEsbuildPlugin } from "unplugin";
import unpluginFactory from "./generator/unplugin-factory";

export default createEsbuildPlugin(unpluginFactory);
