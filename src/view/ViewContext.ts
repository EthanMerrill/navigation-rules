import {createContext} from "react";
import {IDENTITY_VIEW, ViewTransform} from "./fitView";

/**
 * The play area's current pan and zoom (stage pixels → screen pixels). Drag
 * handles and labels inside the scaled stage divide by `scale` to stay the same
 * size on screen, and re-measure their targets whenever it changes.
 */
export const ViewContext = createContext<ViewTransform>(IDENTITY_VIEW);
