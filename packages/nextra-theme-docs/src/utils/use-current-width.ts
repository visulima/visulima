import { useEffect, useState } from "react";

const getWidth = () => window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

const useCurrentWidth = (): number => {
    // save current window width in the state object
    const [width, setWidth] = useState(0);

    // in this case useEffect will execute only once because
    // it does not have any dependencies.
    useEffect(() => {
        // timeoutId for debounce mechanism
        let timeoutId: NodeJS.Timeout | undefined;
        const resizeListener = () => {
            // prevent execution of previous setTimeout
            clearTimeout(timeoutId);
            // change width from the state object after 150 milliseconds
            timeoutId = setTimeout(() => setWidth(getWidth()), 100);
        };
        // set resize listener
        window.addEventListener("resize", resizeListener);

        // clean up function
        return () => {
            // remove resize listener
            window.removeEventListener("resize", resizeListener);
        };
    }, []);

    return width;
};

export default useCurrentWidth;
