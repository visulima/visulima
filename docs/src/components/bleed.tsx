import cn from "clsx";
import React, { ReactElement, ReactNode } from "react";

const Bleed = ({ full, children }: { full: boolean; children: ReactNode }): ReactElement => (
    <div
        className={cn(
            "nextra-bleed relative -mx-6 mt-6 md:-mx-8 2xl:-mx-24",
            full && [
                // 'md:mx:[calc(-50vw+50%+8rem)',
                "ltr:xl:ml-[calc(50%-50vw+16rem)] ltr:xl:mr-[calc(50%-50vw)]",
                "rtl:xl:ml-[calc(50%-50vw)] rtl:xl:mr-[calc(50%-50vw+16rem)]",
            ],
        )}
    >
        {children}
    </div>
);

export default Bleed;
