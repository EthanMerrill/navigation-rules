/**
 * Rule content — the display text for each rule of the Racing Rules of Sailing
 * (2025–2028 edition), keyed by rule id.
 *
 * The RRS text is © World Sailing; this file reproduces it for education.
 *
 * Entries with `evaluable: true` have a matching predicate in
 * `rules/definitions`; reference-only entries (`evaluable: false`) are shown for
 * context and become evaluable as they are implemented. Titles, descriptions
 * and plain-English explanations of the reference-only entries are summaries,
 * not official wording.
 */

import type {RuleId} from "../types";

/** The edition of the Racing Rules of Sailing this content reproduces. */
export const RRS_EDITION = "2025-2028";

/** Display content for one rule. */
export interface RuleContent {
	id: RuleId;
	title: string;
	/** Static, always-visible short description of the rule. */
	description: string;
	/** The full official text of the rule (2025–2028 RRS); empty when not yet transcribed. */
	fullText: string;
	/** A plain-English explanation of what the rule means. */
	laymanExplanation: string;
	part: 1 | 2 | 3 | 4 | 5;
	/** Section letter, for rules in a Part that has sections (Part 2). */
	section?: "A" | "B" | "C" | "D";
	/** True when a predicate for this rule exists in the rule registry. */
	evaluable: boolean;
	/** A development note describing a known approximation/constraint in this rule. */
	note?: string;
	/** A shorter version of `note`, shown on the rule card while it is active. */
	noteShort?: string;
}

/** Rules that are evaluated by the engine (Part 2, Sections A and B). */
const EVALUABLE_CONTENT: RuleContent[] = [
	{
		id: "10",
		part: 2,
		section: "A",
		evaluable: true,
		title: "On Opposite Tacks",
		description: "A port-tack boat must keep clear of a starboard-tack boat.",
		fullText: "When boats are on opposite tacks, a port-tack boat shall keep clear of a starboard-tack boat.",
		laymanExplanation: "When two boats are on different tacks — one has the wind coming over its left (port) side and the other over its right (starboard) side — the port-tack boat must get out of the way of the starboard-tack boat. Starboard has right of way.",
	},
	{
		id: "11",
		part: 2,
		section: "A",
		evaluable: true,
		title: "On the Same Tack, Overlapped",
		description: "The windward boat must keep clear of the leeward boat.",
		fullText: "When boats are on the same tack and overlapped, a windward boat shall keep clear of a leeward boat.",
		laymanExplanation: "When two boats are on the same tack and side-by-side, the boat that is upwind (closer to where the wind is coming from) must stay out of the way of the boat that is downwind (leeward). The leeward boat has right of way.",
	},
	{
		id: "12",
		part: 2,
		section: "A",
		evaluable: true,
		title: "On the Same Tack, Not Overlapped",
		description: "The boat clear astern must keep clear of the boat clear ahead.",
		fullText: "When boats are on the same tack and not overlapped, a boat clear astern shall keep clear of a boat clear ahead.",
		laymanExplanation: "When two boats are on the same tack and one is clearly in front of the other (not side-by-side), the boat behind must stay out of the way of the boat in front. The boat ahead has right of way.",
	},
	{
		id: "13",
		part: 2,
		section: "A",
		evaluable: true,
		title: "While Tacking",
		description: "After a boat passes head to wind, she must keep clear of other boats until she is on a close-hauled course.",
		fullText: "After a boat passes head to wind, she shall keep clear of other boats until she is on a close-hauled course. During that time rules 10, 11 and 12 do not apply. If two boats are subject to this rule at the same time, the one on the other's port side or the one astern shall keep clear.",
		laymanExplanation: "A boat that is turning through the wind (changing from one tack to the other) loses its normal rights and must stay out of everyone's way until it has finished the turn and is sailing normally again. While it is turning, the usual port/starboard and windward/leeward rules do not apply to it.",
	},
	{
		id: "14",
		part: 2,
		section: "B",
		evaluable: true,
		title: "Avoiding Contact",
		description: "A boat shall avoid contact with another boat if reasonably possible.",
		fullText: "A boat shall avoid contact with another boat if reasonably possible. However, a right-of-way boat, or one sailing within the room or mark-room to which she is entitled, need not act to avoid contact until it is clear that the other boat is not keeping clear or giving room or mark-room.",
		laymanExplanation: "Both boats must always try not to collide. When they get close together, avoiding contact becomes everyone's responsibility — even the boat with right of way has to act if a crash is about to happen.",
	},
	{
		id: "15",
		part: 2,
		section: "B",
		evaluable: true,
		title: "Acquiring Right of Way",
		description: "When a boat acquires right of way, she shall initially give the other boat room to keep clear.",
		fullText: "When a boat acquires right of way, she shall initially give the other boat room to keep clear. She shall not sail to change course to sail a course that would immediately require the other boat to take avoiding action.",
		laymanExplanation: "When you have just gained the right of way, you can't press your advantage straight away — you must first give the other boat enough room to get out of your way.",
	},
	{
		id: "16",
		part: 2,
		section: "B",
		evaluable: true,
		title: "Changing Course",
		description: "When a right-of-way boat changes course, she shall give the other boat room to keep clear.",
		fullText: "When a right-of-way boat changes course, she shall give the other boat room to keep clear. In addition, when after the starting signal a port-tack boat is keeping clear by sailing to pass astern of a starboard-tack boat, the starboard-tack boat shall not change course if as a result the port-tack boat would immediately need to change course to continue keeping clear.",
		laymanExplanation: "Even if you have right of way, you cannot suddenly alter course into the other boat — if you change direction, you must leave them room to stay clear.",
	},
	{
		id: "17.1",
		part: 2,
		section: "B",
		evaluable: true,
		title: "On the Same Tack; Proper Course (leeward from astern)",
		description: "A boat that establishes a leeward overlap from astern must not sail above her proper course.",
		fullText: "If a boat clear astern becomes overlapped within two of her hull lengths to leeward of a boat on the same tack, she shall not sail above her proper course while they remain on the same tack and overlapped within that distance.",
		laymanExplanation: "When you sail up from behind and establish an overlap to leeward of another boat, you cannot then turn up toward the wind to push them — you may sail no higher than the course you would sail toward the finish (your proper course).",
		note: "A boat's proper course is the straight-line bearing to her next mark, no higher than close-hauled on her current tack. A boat with no next mark is assumed to be heading upwind, so her proper course is close-hauled on her current tack. Tide, laylines and the tacks needed to reach an upwind mark are ignored.",
		noteShort: "Proper course: bearing to next mark, else close-hauled.",
	},
	{
		id: "17.2",
		part: 2,
		section: "B",
		evaluable: true,
		title: "On the Same Tack; Proper Course (windward boat)",
		description: "A windward boat close to a leeward boat must not sail below her proper course unless she gybes.",
		fullText: "Except on a beat to windward, while a boat is less than two of her hull lengths from a leeward boat or a boat clear astern that is steering a course to pass to leeward, she shall not sail below her proper course unless she gybes.",
		laymanExplanation: "A windward boat sailing close above a leeward boat cannot bear away below her proper course (unless she gybes) — she cannot force the leeward boat down the course.",
		note: "A boat's proper course is the straight-line bearing to her next mark, no higher than close-hauled on her current tack. A boat with no next mark is assumed to be heading upwind, so her proper course is close-hauled on her current tack. Tide, laylines and the tacks needed to reach an upwind mark are ignored.",
		noteShort: "Proper course: bearing to next mark, else close-hauled.",
	},
	{
		id: "18.2a",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Mark-Room: Overlapped",
		description: "When boats are overlapped at a mark they must both leave on the same side, the outside boat gives the inside boat mark-room.",
		fullText: "", // TODO: official text of rule 18.2(a)
		laymanExplanation: "When two boats side by side are both rounding the same mark on the same side, the boat on the outside must give the boat on the inside enough room to sail to the mark and round it. This applies once either boat is within three hull lengths of the mark.",
		note: "\"Inside\" is approximated as the boat closer to the mark measured perpendicular to the boats' mean heading. Rule 18 only applies between boats whose next mark is this mark; a starting mark with a continuing obstruction is not modelled, and neither is the exception when one boat must tack to sail her proper course.",
		noteShort: "Inside = closer to the mark, across the boats' mean heading.",
	},
	{
		id: "18.2b",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Mark-Room: Overlap Fixed at the Zone",
		description: "If the boats were overlapped when the first reached the zone, the outside boat then gave mark-room; if one was clear ahead, the boat astern gives mark-room.",
		fullText: "", // TODO: official text of rule 18.2(b)
		laymanExplanation: "What matters is how the boats stood when the first of them reached the three-hull-length zone. If they were overlapped then, the one that was outside keeps giving the other room. If one was clear ahead, the boat astern must give the boat ahead room to round.",
		note: "Based on the pair's state at the moment the first boat's hull reached the zone, kept in engine memory.",
		noteShort: "Uses the situation when the first boat reached the zone.",
	},
	{
		id: "18.2c",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Mark-Room: Overlap Changes in the Zone",
		description: "A boat required to give mark-room under 18.2(b) keeps doing so even if the overlap is later broken or a new one begins.",
		fullText: "", // TODO: official text of rule 18.2(c)
		laymanExplanation: "Once the zone entry has settled who gives room, later changes in the overlap do not change it: a boat that has to give room cannot escape the duty by pulling ahead or dropping back, and a boat astern cannot gain mark-room by creating a new overlap.",
		note: "Shown in place of 18.2(b) when the current overlap differs from the overlap recorded at zone entry.",
		noteShort: "Overlap differs from the situation at zone entry.",
	},
	{
		id: "18.3",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Tacking in the Zone",
		description: "A boat that tacks in the zone of a mark to be left to port must not cause a starboard-tack boat to sail above close-hauled to avoid contact, and must give her mark-room if she becomes overlapped inside.",
		fullText: "", // TODO: official text of rule 18.3
		laymanExplanation: "If you tack from port to starboard inside the zone and then fetch the mark, you may not force a boat that has been on starboard tack since entering the zone to luff above close-hauled to avoid you. If that boat ends up overlapped inside you, you must give her room at the mark. This is a limitation on the tacking boat only: it does not decide right of way, so rules 10, 11 and 12 still say who keeps clear.",
		note: "Only marks to be left to port are modelled. \"On starboard tack since entering the zone\" is approximated as being on starboard tack in the zone and not having tacked there. \"Fetching\" is a geometric test. Rule 18.3 suspends no other rule: right of way between the boats is still decided by 10, 11 and 12, and 18.2 may also apply.",
		noteShort: "Port-rounding marks only; fetching is approximated.",
	},
	{
		id: "18.4",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Gybing at a Mark",
		description: "An inside overlapped right-of-way boat that must gybe at a mark must sail no farther from the mark than needed to sail her proper course.",
		fullText: "", // TODO: official text of rule 18.4
		laymanExplanation: "When the inside boat has right of way and has to gybe to round the mark, she may not swing wide of the mark before the gybe: she must stay as close as her proper course needs. This does not apply at a gate mark.",
		note: "She \"must gybe\" is approximated: she is sailing more than 90 degrees from the wind and the mark is on her leeward side.",
		noteShort: "Gybe needed: downwind, mark on her leeward side.",
	},
	{
		id: "19.2b",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Obstruction: Room When Overlapped",
		description: "When boats are overlapped at an obstruction, the outside boat gives the inside boat room between her and the obstruction.",
		fullText: "", // TODO: official text of rule 19.2(b)
		laymanExplanation: "When two boats side by side are passing the same side of an obstruction, the boat on the outside must leave the inside boat enough room to sail between her and the obstruction.",
		note: "Applies when at least one boat is approaching the obstruction (it is ahead of her abeam line and within four hull lengths) and both would pass it on the same side. \"Inside\" is the boat closer to the obstruction measured across the boats' mean heading. The exception for an outside boat that has been unable to give room from the time the overlap began is not modelled, nor is the case where a right-of-way boat is itself the obstruction.",
		noteShort: "Inside = closer to the obstruction; no \"unable to give room\" exception.",
	},
	{
		id: "19.2c",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Obstruction: No Room to Squeeze In",
		description: "A boat that was clear astern and must keep clear is not entitled to room if she becomes overlapped inside when there is no room to pass between the other boat and the obstruction.",
		fullText: "", // TODO: official text of rule 19.2(c)
		laymanExplanation: "A boat coming up from astern cannot force her way in between another boat and the obstruction. If at the moment she becomes overlapped there is not enough room for her to fit, the other boat does not have to give her room under 19.2(b).",
		note: "At the moment the overlap begins, room is approximated as a gap of at least one beam (about 0.48 hull lengths) between the outside boat's hull and the obstruction's edge; the result is kept in engine memory while the overlap lasts. Every obstruction is treated as continuing. While it applies, the squeezing-in boat shows an avoid-contact duty so the rule can appear; it does not change right of way.",
		noteShort: "Room = a beam's gap when the overlap began.",
	},
	{
		id: "20.2",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Responding to a Hail",
		description: "A hailed boat must respond by tacking as soon as possible, or by replying \"You tack\" and then giving the hailing boat room to tack and avoid her.",
		fullText: "", // TODO: official text of rule 20.2
		laymanExplanation: "When a boat has validly hailed for room to tack, the hailed boat has to answer straight away. Either she tacks as soon as she can, or she calls \"You tack\". After that reply she must give the hailing boat room, and the hailing boat must tack as soon as possible.",
		note: "Hails are made with the hail controls and stay until cleared (they do not expire). A hail is valid when the hailer is close-hauled or above, on the same tack as the hailed boat, and approaching an obstruction; the need for a substantial course change is not modelled. Rule 20.1 (validity) and 20.3 (passing the hail on) have no cards of their own.",
		noteShort: "Valid hail: close-hauled, same tack, approaching an obstruction.",
	},
];

/**
 * Reference-only rules: shown for context, not yet evaluated.
 * TODO: official text — `fullText` is empty until it is transcribed from the RRS.
 */
const REFERENCE_CONTENT: RuleContent[] = [
	{id: "1", part: 1, evaluable: false, title: "Safety", description: "Boats must help those in danger and carry life-saving equipment.", fullText: "", laymanExplanation: "A boat or competitor must give all possible help to anyone in danger, and must carry adequate life-saving equipment. Safety comes before the right-of-way rules."},
	{id: "2", part: 1, evaluable: false, title: "Fair Sailing", description: "Boats and owners must compete in compliance with recognized principles of sportsmanship and fair play.", fullText: "", laymanExplanation: "Race honestly and sportingly. A boat may only be penalised for breaking this rule if it is clear she has done so."},
	{id: "3", part: 1, evaluable: false, title: "Acceptance of the Rules", description: "By entering a race, competitors agree to be governed by the rules.", fullText: "", laymanExplanation: "Taking part means you accept the racing rules and the decisions made under them, and agree to resolve disputes through the proper procedures."},
	{id: "18", part: 2, section: "C", evaluable: false, title: "Mark-Room", description: "Rules for giving room at a mark when boats are about to round or pass it.", fullText: "", laymanExplanation: "When boats are about to round or pass a mark on the same side, the rule decides who must give whom room to do it safely."},
	{id: "18.1", part: 2, section: "C", evaluable: false, title: "Mark-Room: When Rule 18 Applies", description: "Rule 18 applies between boats at a mark they are required to leave on the same side.", fullText: "", laymanExplanation: "Rule 18 only works when both boats must pass the mark on the same side; it does not apply at a starting mark surrounded by starting-line obstructions, or between boats on opposite tacks on a beat."},
	{id: "18.2d", part: 2, section: "C", evaluable: false, title: "Mark-Room: Ending the Entitlement", description: "A boat's entitlement to mark-room under 18.2(b) ends when she passes head to wind or leaves the zone.", fullText: "", laymanExplanation: "The entry-based mark-room duty does not last forever: it stops when the boat entitled to it tacks through the wind or leaves the three-hull-length zone. The simulator handles this by releasing its zone-entry memory, so it has no rule card of its own."},
	{id: "19", part: 2, section: "C", evaluable: false, title: "Room to Pass an Obstruction", description: "Rules for giving room to pass an obstruction.", fullText: "", laymanExplanation: "When boats are sailing past an obstruction, the rule decides who must give room to whom."},
	{id: "19.1", part: 2, section: "C", evaluable: false, title: "Obstruction: When Rule 19 Applies", description: "Rule 19 applies at an obstruction, but not at a mark.", fullText: "", laymanExplanation: "The room-to-pass rules apply to boats about to pass an obstruction on the same side; at a mark, rule 18 applies instead."},
	{id: "19.2a", part: 2, section: "C", evaluable: false, title: "Obstruction: Right-of-Way Boat", description: "A right-of-way boat may choose to pass the obstruction on either side.", fullText: "", laymanExplanation: "The right-of-way boat chooses which side to pass the obstruction, subject to the rest of the rule. This is a permission rather than a duty, so the simulator does not emit an obligation for it."},
	{id: "20", part: 2, section: "C", evaluable: false, title: "Room to Tack at an Obstruction", description: "A boat may hail for room to tack to avoid an obstruction.", fullText: "", laymanExplanation: "A boat sailing close-hauled that needs to tack to avoid an obstruction may hail for room, and the hailed boat must respond."},
	{id: "20.1", part: 2, section: "C", evaluable: false, title: "Hailing", description: "A boat close-hauled or above, approaching an obstruction, may hail for room to tack and avoid a boat on the same tack.", fullText: "", laymanExplanation: "The hailing boat calls for room to tack, and must be ready to tack at once. A hail is only valid when she is sailing close-hauled or above, is approaching an obstruction and needs a substantial course change to avoid it safely. The simulator checks the first two when deciding whether a hail has any effect (see rule 20.2)."},
	{id: "20.3", part: 2, section: "C", evaluable: false, title: "Passing Head to Wind", description: "Limits on how a hailing boat tacks and on the hailed boat.", fullText: "", laymanExplanation: "After the hailing boat tacks, the hailed boat may no longer have to respond, and the hailing boat must tack promptly."},
	{id: "21", part: 2, section: "D", evaluable: false, title: "Exoneration", description: "A boat that breaks a rule while entitled to room or mark-room is exonerated.", fullText: "", laymanExplanation: "If a boat breaks a rule of Section A while sailing within the room or mark-room she is entitled to, she is not penalised for it."},
	{id: "22", part: 2, section: "D", evaluable: false, title: "Starting Errors; Taking Penalties; Backing a Sail", description: "Boats returning to start, taking a penalty or backing a sail must keep clear.", fullText: "", laymanExplanation: "A boat that is returning to the pre-start side, taking a penalty, or moving astern by backing a sail has to keep clear of other boats."},
	{id: "23", part: 2, section: "D", evaluable: false, title: "Capsized, Anchored or Aground; Rescuing", description: "A boat that is capsized, anchored, aground or rescuing must be kept clear of.", fullText: "", laymanExplanation: "Boats should keep clear of a boat that is capsized, anchored or aground, or is rescuing a person or vessel."},
	{id: "24", part: 2, section: "D", evaluable: false, title: "Interfering with Another Boat", description: "A boat not racing must not interfere with a boat that is racing.", fullText: "", laymanExplanation: "A boat that is not racing must keep clear of boats that are, and boats must not interfere with another boat sailing a course she is entitled to."},
	{id: "30", part: 3, evaluable: false, title: "Starting Penalties", description: "Penalties for being over the line early, such as the I flag and Z flag rules.", fullText: "", laymanExplanation: "Boats that are on the course side of the starting line near the start may have to return and start correctly, or accept a penalty, depending on the flag displayed."},
	{id: "31", part: 3, evaluable: false, title: "Touching a Mark", description: "A boat shall not touch a starting mark, a mark that begins, bounds or ends the leg, or a finishing mark.", fullText: "", laymanExplanation: "If you touch a mark of the course you must take a penalty by promptly doing a turns penalty."},
	{id: "42", part: 4, evaluable: false, title: "Propulsion", description: "A boat shall compete by using only the wind and water to increase, maintain or decrease her speed.", fullText: "", laymanExplanation: "You can only use the wind and the water to drive the boat. Pumping, rocking and sculling are generally not allowed except where the rule specifically permits."},
	{id: "44", part: 4, evaluable: false, title: "Penalties at the Time of an Incident", description: "A boat that may have broken a rule may take a penalty to avoid a hearing.", fullText: "", laymanExplanation: "Doing a turns penalty promptly after an incident, as the rule provides, can avoid a protest and a possible disqualification."},
];

/** Every rule's content, keyed by rule id. */
export const RULE_CONTENT: Record<RuleId, RuleContent> = Object.fromEntries([...EVALUABLE_CONTENT, ...REFERENCE_CONTENT].map((c) => [c.id, c]));

/** The content for a rule id; throws for an id with no content entry. */
export function contentOf(id: RuleId): RuleContent {
	const content = RULE_CONTENT[id];
	if (!content) throw new Error(`No rule content for rule id "${id}"`);
	return content;
}
