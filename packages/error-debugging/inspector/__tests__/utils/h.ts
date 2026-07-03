const h = (name: string, attributes?: Record<string, any>, ...children: any[]): HTMLElement => {
    const container = document.createElement(name);

    if (attributes) {
        for (const key of Object.keys(attributes)) {
            container.setAttribute(key, attributes[key]);
        }
    }

    for (const child of children) {
        container.append(child as string | Node);
    }

    return container;
};

export default h;
