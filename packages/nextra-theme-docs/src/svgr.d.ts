declare module "*.svg" {
    import type { ComponentPropsWithRef } from "react";

    export default (properties: ComponentPropsWithRef<"svg">) => JSX.Element;
}
