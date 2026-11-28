import type {RuleId} from "./types";

/** A rule id as the RRS prints it: "18.2a" → "18.2(a)", "43.1b" → "43.1(b)"; "16.1" is unchanged. */
export function formatRuleId(id: RuleId): string {
	return id.replace(/^(\d+\.\d+)([a-z])$/, "$1($2)");
}
