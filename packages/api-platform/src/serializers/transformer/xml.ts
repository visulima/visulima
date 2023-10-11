import type { XmlElement } from "jstoxml";
import { toXML } from "jstoxml";

import type { Serializer } from "../types";

const xmlTransformer: Serializer = (data?: XmlElement | XmlElement[]) =>
    toXML(data, {
        header: true,
        indent: "  ",
    });

export default xmlTransformer;
