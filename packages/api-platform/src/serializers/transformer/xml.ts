import type { XmlElement } from "jstoxml";
import xml from "jstoxml";

import type { Serializer } from "../types";

const xmlTransformer: Serializer = (data?: XmlElement | XmlElement[]) => xml.toXML(data, {
    header: true,
    indent: "  ",
});

export default xmlTransformer;
