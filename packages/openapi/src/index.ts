import { createUnplugin } from "unplugin";
import unpluginFactory from "./generator/unplugin-factory";

const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory);

export default unplugin;
