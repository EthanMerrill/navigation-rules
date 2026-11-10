import {useEffect, useState} from "react";

const ROUTE_PATTERN = /^#\/scenario\/([^/?#]+)$/;

/** The scenario id in a location hash of the form `#/scenario/<id>`, or null. */
export function parseScenarioHash(hash: string): string | null {
	const match = ROUTE_PATTERN.exec(hash);
	return match ? decodeURIComponent(match[1]) : null;
}

/** The hash for a scenario id. */
export function scenarioHash(id: string): string {
	return `#/scenario/${encodeURIComponent(id)}`;
}

/** The current scenario id from `window.location.hash` (null when none), updated on `hashchange`. */
export function useScenarioRoute(): string | null {
	const [id, setId] = useState<string | null>(() => parseScenarioHash(window.location.hash));

	useEffect(() => {
		const onHashChange = () => setId(parseScenarioHash(window.location.hash));
		window.addEventListener("hashchange", onHashChange);
		return () => window.removeEventListener("hashchange", onHashChange);
	}, []);

	return id;
}
