const reportWebVitals = (onPerfEntry?: () => void) => {
    if (onPerfEntry && typeof onPerfEntry === "function") {
        import("web-vitals").then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
            onCLS(onPerfEntry);
            onINP(onPerfEntry);
            onFCP(onPerfEntry);
            onLCP(onPerfEntry);
            onTTFB(onPerfEntry);
        });
    }
};

export default reportWebVitals;
