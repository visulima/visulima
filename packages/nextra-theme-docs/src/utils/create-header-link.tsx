import { useEffect, useRef } from "react";
import { Balancer } from "react-wrap-balancer";

import type { ComponentProps, ReactElement } from "react";

import { useSetActiveAnchor } from "../contexts";
import { useIntersectionObserver, useSlugCounter, useSlugs } from "../contexts/active-anchor";

const createHeaderLink =
    (Tag: `h${2 | 3 | 4 | 5 | 6}`) =>
    ({ children, id = "", ...properties }: ComponentProps<"h1" | "h2" | "h3" | "h4" | "h5" | "h6">): ReactElement => {
        const setActiveAnchor = useSetActiveAnchor();
        const slugs = useSlugs();
        const observer = useIntersectionObserver();
        const obReference = useRef<HTMLAnchorElement>(null);
        let counter = useSlugCounter();

        useEffect(() => {
            const heading = obReference.current;

            if (!heading) {
                return;
            }

            slugs.set(heading, [id, (counter += 1)]);
            observer?.observe(heading);

            // eslint-disable-next-line consistent-return
            return () => {
                observer?.disconnect();
                slugs.delete(heading);

                setActiveAnchor((f) => {
                    const returnValue = { ...f };

                    if (id && id in returnValue) {
                        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                        delete returnValue[id];
                    }

                    return returnValue;
                });
            };
        }, [id, slugs, observer, setActiveAnchor]);

        return (
            <Tag
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...properties}
            >
                <Balancer>{children}</Balancer>
                <span className="absolute -mt-20" id={id} ref={obReference} />
                {/* eslint-disable-next-line jsx-a11y/anchor-has-content */}
                <a href={`#${id}`} className="subheading-anchor" aria-label="Permalink for this section" />
            </Tag>
        );
    };

export default createHeaderLink;
