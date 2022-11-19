import type { MutableRefObject } from "react";
import React, { useState, useEffect  } from "react";

const useOnScreen = <T extends Element>(ref: MutableRefObject<T>, rootMargin: string = "0px") => {
    const [isIntersecting, setIntersecting] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Update our state when observer callback fires
                setIntersecting(entry.isIntersecting);
            },
            {
                rootMargin,
            },
        );

        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => {
            observer.unobserve(ref.current);
        };
    }, []);

    return isIntersecting;
}

export default useOnScreen
