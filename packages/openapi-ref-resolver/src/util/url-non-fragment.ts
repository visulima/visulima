import { URL } from "node:url";

const urlNonFragment = (url: URL): URL => {
    const urlNoFragment = new URL(url.href);

    urlNoFragment.hash = "";

    return urlNoFragment;
};

export default urlNonFragment;
