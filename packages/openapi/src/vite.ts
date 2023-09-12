import { createVitePlugin } from "unplugin";
import unpluginFactory from "./core/plugin-factory";

export default createVitePlugin(unpluginFactory);
