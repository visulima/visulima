import type { ReactElement, ReactNode } from "react";

import { cn } from "../utils";

const Bleed = ({ children, className, full }: { children: ReactNode; className?: string; full: boolean }): ReactElement => (
    <div
        className={cn(
            "nextra-bleed relative -mx-6 mt-6 lg:-mx-8 2xl:-mx-24",
            full && [
                // 'lg:mx:[calc(-50vw+50%+8rem)',
                "ltr:xl:ml-[calc(50%-50vw+16rem)] ltr:xl:mr-[calc(50%-50vw)]",
                "rtl:xl:ml-[calc(50%-50vw)] rtl:xl:mr-[calc(50%-50vw+16rem)]",
            ],
            className,
        )}
    >
        {children}
    </div>
);

export default Bleed;
