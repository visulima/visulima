import { createVitePlugin } from "unplugin";
import unpluginFactory from "./generator/unplugin-factory";

export default createVitePlugin(unpluginFactory);
