// eslint-disable-next-line import/no-unused-modules
import type { PnpApi } from "@yarnpkg/pnp";

declare module "module" {
    // eslint-disable-next-line import/no-unused-modules,@typescript-eslint/no-redundant-type-constituents,import/prefer-default-export
    export const findPnpApi: ((lookupSource: URL | string) => PnpApi | null) | undefined;
}
