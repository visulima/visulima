import type { MutableRefObject } from "react";
import { useEffect, useState } from "react";

const useOnScreen = <T extends Element>(reference: MutableRefObject<T>): boolean => {
    const [isIntersecting, setIntersecting] = useState(false);

    useEffect(() => {
        const { current } = reference;

        // eslint-disable-next-line compat/compat
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIntersecting(entry.isIntersecting);
            },
            {
                rootMargin: "-150px 0px 0px 0px",
            },
        );

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (current) {
            observer.observe(current);
        }

        return () => observer.disconnect();
    }, [reference]);

    return isIntersecting;
};

export default useOnScreen;
