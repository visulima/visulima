import type { Toolbox as IToolbox } from "./toolbox";

type ExtensionSetup = (toolbox: IToolbox) => Promise<void> | void;

/**
 * An extension will add functionality to the toolbox that each addCommand will receive.
 */
export interface Extension {
    /** The description. */
    description?: string;
    /** The function used to attach functionality to the toolbox. */
    execute: ExtensionSetup;
    /** The file this extension comes from. */
    file?: string;
    /** The name of the extension. */
    name: string;
}
