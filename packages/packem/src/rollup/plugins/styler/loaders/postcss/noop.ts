import type { PluginCreator } from "postcss";

const name = "styles-noop";

const plugin: PluginCreator<unknown> = () => {return { postcssPlugin: name }};

plugin.postcss = true;

export default plugin;
