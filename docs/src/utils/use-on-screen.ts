import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";

const useOnScreen = <T extends Element>(reference: MutableRefObject<T>, rootMargin: string = "0px") => {
    const [isIntersecting, setIntersecting] = useState(false);

    useEffect(() => {
        const current = reference?.current;

        // eslint-disable-next-line compat/compat
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Update our state when observer callback fires
                setIntersecting(entry.isIntersecting);
            },
            {
                rootMargin,
            },
        );

        if (current !== undefined && current !== null) {
            observer.observe(current);
        }

        return () => {
            if (current !== undefined && current !== null) {
                observer.unobserve(current);
            }
        };
    }, [reference, rootMargin]);

    return isIntersecting;
};

export default useOnScreen;
