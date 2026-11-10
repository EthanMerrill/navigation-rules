/**
 * Exoneration (Rule 21) — a post-pass over the obligations of each pair, run by
 * `evaluate` after the rules have fired and been subject to suspension.
 *
 * When boat X owes room or mark-room to boat Y, any Rule 10-13, 15 or 16
 * obligation Y has towards X is marked `exoneratedBy: "21"`: if the two meet in
 * an incident while Y is sailing within that room she is not penalised.
 * Exoneration only protects against a penalty. It leaves `kind` untouched, so it
 * never changes who has right of way (that is derived from `keepClear` obligations).
 *
 * APPROXIMATIONS: "sailing within the room to which she is entitled" is not
 * checked (the room is simply owed); rule 31 (touching a mark) is not modelled.
 */

import type {Obligation, RuleId} from "./types";

/** The Section A, B rules a boat entitled to room is exonerated for breaking (Rule 21; rule 31 is not modelled). */
const EXONERATED_RULES: ReadonlySet<RuleId> = new Set(["10", "11", "12", "13", "15", "16"]);

/** Rules whose giveRoom duty is "give room to keep clear", not room or mark-room as such; they never create an entitlement. */
const NOT_ROOM_SOURCES: ReadonlySet<RuleId> = new Set(["15", "16"]);

/** An exoneration that was applied, for the Rule 21 card. */
export interface ExonerationNote {
	pair: string;
	text: string;
}

/** Anything with a list of obligations and, for pair-scope rules, the pair key. */
interface HasObligations {
	obligations: Obligation[];
	pair?: string;
}

/**
 * Mark exonerated obligations in place: replaces each affected obligation in
 * `fired[i].obligations` with a copy carrying `exoneratedBy: "21"`.
 *
 * @returns One note per exonerated obligation.
 */
export function applyExoneration(fired: HasObligations[], pairKeys: string[]): ExonerationNote[] {
	const notes: ExonerationNote[] = [];
	for (const key of pairKeys) {
		const inPair = fired.filter((f) => f.pair === key);
		const all = inPair.flatMap((f) => f.obligations);
		const rooms = all.filter((o) => (o.kind === "giveRoom" || o.kind === "giveMarkRoom") && !NOT_ROOM_SOURCES.has(o.ruleId) && o.towards !== undefined);
		const marked = new Map<Obligation, Obligation>();
		for (const duty of all) {
			if (!EXONERATED_RULES.has(duty.ruleId) || duty.towards === undefined) continue;
			const room = rooms.find((r) => r.boat === duty.towards && r.towards === duty.boat);
			if (!room) continue;
			marked.set(duty, {...duty, exoneratedBy: "21"});
			const what = room.kind === "giveMarkRoom" ? "mark-room" : "room";
			notes.push({pair: key, text: `Rule 21 — ${duty.boat} is exonerated if she breaks Rule ${duty.ruleId} in an incident with ${duty.towards}, because she is sailing within the ${what} ${duty.towards} owes her (Rule ${room.ruleId}).`});
		}
		for (const f of inPair) f.obligations = f.obligations.map((o) => marked.get(o) ?? o);
	}
	return notes;
}
