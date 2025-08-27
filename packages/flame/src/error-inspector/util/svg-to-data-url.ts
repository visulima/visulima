const svgToDataUrl = (svgContent: string): string => {
    const cleanSvg = svgContent
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ")
        .trim();

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(cleanSvg)}`;
};

export default svgToDataUrl;
