import type { ComponentProps, ReactElement } from "react";
import { useEffect, useRef } from "react";
import { Balancer } from "react-wrap-balancer";

import cn from "clsx";
import { useRouter } from "next/router";
import { useConfig, useObserver } from "../contexts";
import { renderString } from "./render";
import { DEFAULT_LOCALE } from "../constants/base";

const createHeaderLink =
    (Tag: `h${2 | 3 | 4 | 5 | 6}`) =>
    ({ children, className, id = "", ...properties }: ComponentProps<"h1" | "h2" | "h3" | "h4" | "h5" | "h6">): ReactElement => {
        const anchorReference = useRef<HTMLAnchorElement>(null);
        const observer = useObserver();
        const config = useConfig();
        const { locale } = useRouter();

        useEffect(() => {
            if (!id || !observer) {
                return;
            }

            const element = anchorReference.current;

            if (element) {
                observer.observe(element);
            }

            // eslint-disable-next-line consistent-return
            return () => {
                if (element) {
                    observer.unobserve(element);
                }
            };
        }, [id, observer]);

        return (
            <Tag
                className={cn({
                    "sr-only": className === "sr-only",
                })}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            >
                <Balancer>{children}</Balancer>
                {id && (
                    <a className="subheading-anchor" href={`#${id}`} id={id} ref={anchorReference}>
                        <div className="sr-only">{renderString(config.content.permalink.label, { locale: locale ?? DEFAULT_LOCALE })}</div>
                    </a>
                )}
            </Tag>
        );
    };

export default createHeaderLink;
