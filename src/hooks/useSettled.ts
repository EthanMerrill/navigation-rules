import {useEffect, useRef, useState} from "react";

/** How long the rules must stay the same after a change before the sidebar re-sorts, in ms. */
export const SETTLE_MS = 450;

interface Settled<T> {
	/** The last settled value: what to show. */
	value: T;
	/** True while the live value is changing (a drag is moving things, or it changed less than `delayMs` ago). */
	settling: boolean;
}

/**
 * Debounces a derived view so it only updates once things have settled.
 *
 * - While `held` (the pointer is down on the water) and the world changes, the
 *   shown value freezes and `settling` is true, for as long as the drag lasts.
 * - After the drag ends, or after a change made some other way (keyboard, a
 *   scenario load), the shown value updates once `signature` has stayed the same
 *   for `delayMs`.
 * - Changes that leave `signature` the same while nothing is settling (e.g. a
 *   distance in a rule's detail text) show at once.
 *
 * @param value The live value.
 * @param signature Identifies what matters about `value`: a change in it starts settling.
 * @param changeToken Changes whenever the world changes (the live evaluation object).
 * @param held Whether the pointer is held down on the water.
 * @param resetKey When this changes (a scenario was loaded), the new value shows at once.
 */
export function useSettled<T>(value: T, signature: string, changeToken: unknown, held: boolean, resetKey: unknown = 0, delayMs = SETTLE_MS): Settled<T> {
	const [shown, setShown] = useState({value, signature});
	const [settling, setSettling] = useState(false);
	const latest = useRef({value, signature});
	latest.current = {value, signature};
	const timer = useRef<number | undefined>(undefined);
	const tokenAtHold = useRef<unknown>(undefined);
	const settlingRef = useRef(false);
	const lastResetKey = useRef(resetKey);

	useEffect(() => {
		const clear = () => {
			if (timer.current !== undefined) window.clearTimeout(timer.current);
			timer.current = undefined;
		};
		const start = (on: boolean) => {
			settlingRef.current = on;
			setSettling(on);
		};

		if (resetKey !== lastResetKey.current) {
			lastResetKey.current = resetKey;
			clear();
			start(false);
			setShown({value, signature});
			return;
		}
		if (held) {
			if (tokenAtHold.current === undefined) tokenAtHold.current = changeToken;
			else if (changeToken !== tokenAtHold.current) start(true);
			clear();
			return;
		}
		tokenAtHold.current = undefined;

		if (settlingRef.current || signature !== shown.signature) {
			start(true);
			clear();
			timer.current = window.setTimeout(() => {
				timer.current = undefined;
				setShown(latest.current);
				start(false);
			}, delayMs);
			return;
		}
		setShown({value, signature});
		// `value` and `signature` follow `changeToken`; reacting to the token alone keeps re-renders that change nothing from restarting the timer.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [changeToken, held, resetKey]);

	useEffect(() => () => window.clearTimeout(timer.current), []);

	return {value: shown.value, settling};
}
