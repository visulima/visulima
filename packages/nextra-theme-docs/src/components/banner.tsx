import cn from "clsx";
import { XIcon } from "nextra/icons";
import React, { ReactElement } from "react";

import { useConfig } from "../contexts";
import { renderComponent } from "../utils";

const Banner = (): ReactElement | null => {
    const { banner } = useConfig();
    if (!banner.text) {
        return null;
    }
    const hideBannerScript = `try{if(localStorage.getItem(${JSON.stringify(
        banner.key,
    )})==='0'){document.body.classList.add('nextra-banner-hidden')}}catch(e){}`;

    return (
        <>
            {/* eslint-disable-next-line react/no-danger */}
            <script dangerouslySetInnerHTML={{ __html: hideBannerScript }} />
            <div
                className={cn(
                    "relative z-20 flex items-center justify-center",
                    "bg-neutral-900 text-sm font-medium text-slate-50",
                    "h-[var(--nextra-banner-height)] [body.nextra-banner-hidden_&]:hidden",
                    "dark:bg-[linear-gradient(1deg,#383838,#212121)] dark:text-white",
                    "py-1 pl-[max(env(safe-area-inset-left),2.5rem)] pr-[max(env(safe-area-inset-right),2.5rem)]",
                )}
            >
                <div className="max-w-[90rem] truncate">{renderComponent(banner.text)}</div>
                {banner.dismissible && (
                    <button
                        className="absolute opacity-80 hover:opacity-100 ltr:right-0 rtl:left-0"
                        type="button"
                        onClick={() => {
                            try {
                                localStorage.setItem(banner.key, "0");
                                // eslint-disable-next-line no-empty
                            } catch {}
                            document.body.classList.add("nextra-banner-hidden");
                        }}
                    >
                        <XIcon className="mx-4 h-4 w-4" />
                    </button>
                )}
            </div>
        </>
    );
};

export default Banner;
