import type { XmlElement } from "jstoxml";
import { toXML } from "jstoxml";

import type { Serializer } from "../types";

const xmlTransformer: Serializer = (data) =>
    toXML(data as XmlElement | XmlElement[] | undefined, {
        header: true,
        indent: "  ",
    });

export default xmlTransformer;
