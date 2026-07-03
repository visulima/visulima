import type { PnpApi } from "@yarnpkg/pnp";

declare module "module" {
    // eslint-disable-next-line import/prefer-default-export
    export const findPnpApi: ((lookupSource: URL | string) => PnpApi | null) | undefined;
}
