import {createContext} from "react";
import {IDENTITY_VIEW, ViewTransform} from "./fitView";

/**
 * The play area's current pan and zoom (stage pixels → screen pixels). Drag
 * handles and labels inside the scaled stage divide by `scale` to stay the same
 * size on screen, and re-measure their targets whenever it changes. Badges
 * also use the viewport size to stay on screen.
 */
export interface ViewState extends ViewTransform {
	/** Size of the play area in screen pixels (0 until measured). */
	viewportWidth: number;
	viewportHeight: number;
}

export const ViewContext = createContext<ViewState>({...IDENTITY_VIEW, viewportWidth: 0, viewportHeight: 0});
