import cn from "clsx";
import { XIcon } from "nextra/icons";
import type { ReactElement } from "react";

import { useConfig } from "../contexts";
import { renderComponent } from "../utils/render";

const Banner = (): ReactElement | null => {
    const { banner } = useConfig();

    if (!banner.content) {
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
                    "nextra-banner-container sticky top-0 z-20 flex items-center lg:relative print:hidden",
                    "bg-neutral-900 text-sm text-slate-50",
                    "h-[var(--nextra-banner-height)] [body.nextra-banner-hidden_&]:hidden",
                    "dark:bg-[linear-gradient(1deg,#383838,#212121)] dark:text-white",
                    "ltr:pl-10 rtl:pr-10",
                )}
            >
                <div
                    className={cn(
                        "mx-auto w-full max-w-[90rem]",
                        "truncate whitespace-nowrap",
                        "py-1 pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]",
                        "text-center font-medium",
                    )}
                >
                    {renderComponent(banner.content)}
                </div>
                {banner.dismissible && (
                    <button
                        className="w-8 opacity-80 hover:opacity-100 ltr:mr-2 rtl:ml-2"
                        onClick={() => {
                            try {
                                localStorage.setItem(banner.key as string, "0");
                            } catch {
                                /* empty */
                            }

                            document.body.classList.add("nextra-banner-hidden");
                        }}
                        type="button"
                    >
                        <XIcon className="mx-auto h-4 w-4" />
                    </button>
                )}
            </div>
        </>
    );
};

export default Banner;
