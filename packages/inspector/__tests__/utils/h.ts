// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (name: string, attributes?: Record<string, any>, ...children: any[]): HTMLElement => {
    const container = document.createElement(name);

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const key in attributes) {
        container.setAttribute(key, attributes[key]);
    }

    // eslint-disable-next-line guard-for-in,no-restricted-syntax
    for (const index in children) {
        container.append(children[index]);
    }

    return container;
};

export default h;
