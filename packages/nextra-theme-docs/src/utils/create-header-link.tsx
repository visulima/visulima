import type { ComponentProps, ReactElement } from "react";
import { useEffect, useRef } from "react";
import { Balancer } from "react-wrap-balancer";

import cn from "clsx";
import { useRouter } from "next/router";
import { useConfig, useSetActiveAnchor } from "../contexts";
import { useIntersectionObserver, useSlugCounter, useSlugs } from "../contexts/active-anchor";
import { renderString } from "./render";
import { DEFAULT_LOCALE } from "../constants/base";

const createHeaderLink =
    (Tag: `h${2 | 3 | 4 | 5 | 6}`) =>
    ({ children, className, id = "", ...properties }: ComponentProps<"h1" | "h2" | "h3" | "h4" | "h5" | "h6">): ReactElement => {
        const setActiveAnchor = useSetActiveAnchor();
        const slugs = useSlugs();
        const observer = useIntersectionObserver();
        const obReference = useRef<HTMLAnchorElement>(null);
        const referenceObject = useSlugCounter();
        const config = useConfig();
        const { locale } = useRouter();

        useEffect(() => {
            const heading = obReference.current;

            if (!heading) {
                return;
            }

            slugs.set(heading, [id, (referenceObject.current += 1)]);
            observer?.observe(heading);

            // eslint-disable-next-line consistent-return
            return () => {
                observer?.disconnect();
                slugs.delete(heading);

                setActiveAnchor((f) => {
                    const returnValue = { ...f };

                    if (id && id in returnValue) {
                        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete,security/detect-object-injection
                        delete returnValue[id];
                    }

                    return returnValue;
                });
            };
        }, [id, slugs, observer, setActiveAnchor, referenceObject]);

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
                    <a className="subheading-anchor" href={`#${id}`} id={id} ref={obReference}>
                        <div className="sr-only">{renderString(config.content.permalink.label, { locale: locale ?? DEFAULT_LOCALE })}</div>
                    </a>
                )}
            </Tag>
        );
    };

export default createHeaderLink;
