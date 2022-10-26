import { toXML } from "jstoxml";

import type { Serializer } from "./types";

const config = {
    indent: "  ",
    header: true,
};

const xmlTransformer: Serializer = (data) => toXML(data, config);

export default xmlTransformer;
