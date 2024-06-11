// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (name: string, attributes?: Record<string, any>, ...children: any[]): HTMLElement => {
    const container = document.createElement(name);

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax
    for (const key in attributes) {
        // eslint-disable-next-line security/detect-object-injection
        container.setAttribute(key, attributes[key]);
    }

    // eslint-disable-next-line guard-for-in,no-loops/no-loops,no-restricted-syntax,@typescript-eslint/no-for-in-array
    for (const index in children) {
        // eslint-disable-next-line security/detect-object-injection
        container.append(children[index]);
    }

    return container;
};

export default h;
