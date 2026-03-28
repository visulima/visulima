import { useContext } from "react";

import type { Props } from "../components/StderrContext";
import StderrContext from "../components/StderrContext";

/**
 * A React hook that returns the stderr stream.
 */
const useStderr = (): Props => useContext(StderrContext);

export default useStderr;
