import { createUnplugin } from "unplugin";
import unpluginFactory from "./core/plugin-factory";

const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory);

export default unplugin;
