import type { XmlElement } from "jstoxml";
import { toXML } from "jstoxml";

import type { Serializer } from "./types";

const config = {
    header: true,
    indent: "  ",
};

const xmlTransformer: Serializer = (data?: XmlElement | XmlElement[]) => toXML(data, config);

export default xmlTransformer;
