import {useCallback, useState} from "react";

const STORAGE_KEY = "rules-sidebar.collapsed";

/** Read the persisted collapsed keys, or `defaults` when none are stored or storage fails. */
function readCollapsed(defaults: string[]): Set<string> {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (raw !== null) {
			const parsed: unknown = JSON.parse(raw);
			if (Array.isArray(parsed)) return new Set(parsed.filter((key): key is string => typeof key === "string"));
		}
	} catch {
		// Storage unavailable or corrupt: fall back to the defaults.
	}
	return new Set(defaults);
}

/**
 * The set of collapsed sidebar group keys, persisted to localStorage (all
 * access is guarded; the sidebar works without storage). `defaults` is used
 * only until the user first toggles a group.
 */
export function useCollapsedGroups(defaults: string[]): {isCollapsed: (key: string) => boolean; toggle: (key: string) => void} {
	const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(defaults));

	const toggle = useCallback((key: string) => {
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (!next.delete(key)) next.add(key);
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
			} catch {
				// Not persisted; the in-memory state still works.
			}
			return next;
		});
	}, []);

	const isCollapsed = useCallback((key: string) => collapsed.has(key), [collapsed]);
	return {isCollapsed, toggle};
}
