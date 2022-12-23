import { stringify } from "yaml";

import type { Serializer } from "../types";

const yamlTransformer: Serializer = (data) => stringify(data, { indent: 2 });

export default yamlTransformer;
