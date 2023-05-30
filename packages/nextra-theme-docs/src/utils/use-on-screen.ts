import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";

const useOnScreen = <T extends Element>(reference: MutableRefObject<T>, rootMargin: string = "0px"): boolean => {
    const [isIntersecting, setIntersecting] = useState(false);

    useEffect(() => {
        const { current } = reference;

        // eslint-disable-next-line compat/compat
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Update our state when observer callback fires
                if (entry.isIntersecting) {
                    setIntersecting(entry.isIntersecting);
                }
            },
            {
                rootMargin,
            },
        );

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (current) {
            observer.observe(current);
        }

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (current) {
                observer.unobserve(current);
            }
        };
    }, [reference, rootMargin]);

    return isIntersecting;
};

export default useOnScreen;
