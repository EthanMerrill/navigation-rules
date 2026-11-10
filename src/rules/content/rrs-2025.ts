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
		fullText: "When a boat acquires right of way, she shall initially give the other boat room to keep clear, unless she acquires right of way because of the other boat's actions.",
		laymanExplanation: "When you have just gained the right of way, you can't press your advantage straight away — you must first give the other boat enough room to get out of your way. The exception is when you gained it because of what the other boat did, for example by tacking in front of you.",
		note: "Fires on the frame right of way changes hands. The exception for right of way acquired because of the other boat's actions is approximated: the rule does not fire when, on that frame, only the other boat was changing course (heading change over 0.5 degrees).",
		noteShort: "Not when only the other boat was turning.",
	},
	{
		id: "16.1",
		part: 2,
		section: "B",
		evaluable: true,
		title: "Changing Course",
		description: "When a right-of-way boat changes course, she shall give the other boat room to keep clear.",
		fullText: "When a right-of-way boat changes course, she shall give the other boat room to keep clear.",
		laymanExplanation: "Even if you have right of way, you cannot suddenly alter course into the other boat — if you change direction, you must leave them room to stay clear.",
	},
	{
		id: "16.2",
		part: 2,
		section: "B",
		evaluable: true,
		title: "Changing Course: Bearing Away on a Beat",
		description: "On a beat to windward, a starboard-tack boat shall not bear away if that makes a port-tack boat passing to leeward of her change course at once.",
		fullText: "In addition, on a beat to windward when a port-tack boat is keeping clear by sailing to pass to leeward of a starboard-tack boat, the starboard-tack boat shall not bear away if as a result the port-tack boat must change course immediately to continue keeping clear.",
		laymanExplanation: "When a port-tack boat is ducking behind you on a beat, you cannot suddenly bear away and close the gap on her. You may only bear away if she can still keep clear without changing course at once.",
		note: "Fires when both boats are close-hauled on opposite tacks, the port-tack boat is on the starboard-tack boat's leeward side and abaft her centre, and the starboard-tack boat's angle to the wind grew by more than 0.5 degrees since last frame. \"Sailing to pass to leeward\" is approximated by that position. Whether the port-tack boat actually has to change course immediately is not checked. A beat to windward is approximated as close-hauled or head to wind.",
		noteShort: "Bearing away, port boat to leeward and abaft; effect on her not checked.",
	},
	{
		id: "17",
		part: 2,
		section: "B",
		evaluable: true,
		title: "On the Same Tack; Proper Course",
		description: "A boat that establishes a leeward overlap from astern must not sail above her proper course.",
		fullText: "If a boat clear astern becomes overlapped within two of her hull lengths to leeward of a boat on the same tack, she shall not sail above her proper course while they remain on the same tack and overlapped within that distance, unless in doing so she promptly sails astern of the other boat.",
		laymanExplanation: "When you sail up from behind and establish an overlap to leeward of another boat, you cannot then turn up toward the wind to push them — you may sail no higher than the course you would sail toward the finish (your proper course). You may luff above it only if you do so to pass promptly astern of the other boat.",
		note: "A boat's proper course is the straight-line bearing to her next mark, no higher than close-hauled on her current tack. A boat with no next mark is assumed to be heading upwind, so her proper course is close-hauled on her current tack. Tide, laylines and the tacks needed to reach an upwind mark are ignored. The exception \"unless in doing so she promptly sails astern of the other boat\" is not modelled. A boat has no proper course before her starting signal, so the rule does not fire while the race is in the pre-start phase. The old Rule 17.2 was deleted in the 2025-2028 edition.",
		noteShort: "Proper course: bearing to next mark, else close-hauled. Not before the start.",
	},
	{
		id: "18.2a",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Mark-Room: Giving Mark-Room at the Zone",
		description: "When the first of two boats reaches the zone: if overlapped, the outside boat gives the inside boat mark-room; if not, the boat that has not reached the zone gives the other boat mark-room. The duty continues even if an overlap is later broken or begun.",
		fullText: "", // TODO: official text of rule 18.2(a)
		laymanExplanation: "What matters is how the boats stood when the first of them reached the three-hull-length zone. If they were overlapped then, the boat that was outside keeps giving the other room. If they were not, the boat that had not yet reached the zone gives the other boat room. Later changes in the overlap do not change it, until the boat entitled to mark-room tacks or leaves the zone (18.2(b)).",
		note: "Based on the pair's state at the moment the first boat's hull reached the zone, kept in engine memory while the latch is live. \"Inside\" is the boat closer to the mark measured across the boats' mean heading. When both boats are already in the zone the first frame they are seen, the boat clear ahead counts as having reached it first. The card's detail says which sub-clause applied and whether the overlap has since changed.",
		noteShort: "Uses the situation when the first boat reached the zone.",
	},
	{
		id: "18.2c",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Mark-Room: Overlapped When 18.2(a) Does Not Apply",
		description: "When rule 18.2(a) does not apply and the boats are overlapped, the outside boat gives the inside boat mark-room.",
		fullText: "", // TODO: official text of rule 18.2(c)
		laymanExplanation: "If the boats did not fix who gives room when the first of them reached the zone, or that duty has ended because the boat entitled to mark-room tacked or left the zone, then any boats that are overlapped at the mark are subject to the simple rule: the outside boat gives the inside boat room.",
		note: "Fires only when no 18.2(a) latch is live between the pair at the mark and the boats are overlapped. \"Inside\" is the boat closer to the mark measured across the boats' mean heading. Between boats at a mark Rule 18 applies only while both have it as their next mark and at least one is in the zone.",
		noteShort: "No live 18.2(a) latch; overlapped at the mark.",
	},
	{
		id: "18.3",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Tacking in the Zone",
		description: "When a boat tacks from port to starboard in the zone of a mark to be left to port, rule 18.2 does not apply between her and a starboard-tack boat that is fetching the mark. If that boat has been on starboard tack since entering the zone, the tacker must not force her above close-hauled and must give her mark-room if she becomes overlapped inside.",
		fullText: "", // TODO: official text of rule 18.3
		laymanExplanation: "If you tack from port to starboard inside the zone and a starboard-tack boat is fetching the mark, the usual mark-room rule 18.2 stops applying between you. If that boat has been on starboard tack since entering the zone, you may not force her to luff above close-hauled to avoid you, and if she ends up overlapped inside you, you must give her room at the mark. Rules 10, 11 and 12 still say who keeps clear.",
		note: "Only marks to be left to port are modelled. It suspends 18.2(a) and 18.2(c) between the tacker and the starboard boat (it does not suspend rules 10 to 12). The duties are imposed only on the boat fetching the mark: \"the other boat\" is read as the fetching starboard-tack boat. \"On starboard tack since entering the zone\" is approximated as being on starboard tack in the zone and not having tacked there. \"Fetching\" is a geometric test that ignores wind and leeway.",
		noteShort: "Port-rounding marks only; fetching is approximated.",
	},
	{
		id: "18.4",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Gybing in the Zone",
		description: "An inside overlapped right-of-way boat that must gybe at a mark must sail no farther from the mark than needed to sail her proper course.",
		fullText: "", // TODO: official text of rule 18.4
		laymanExplanation: "When the inside boat has right of way and has to gybe to round the mark, she may not swing wide of the mark before the gybe: she must stay as close as her proper course needs. This does not apply at a gate mark.",
		note: "She \"must gybe\" is approximated: she is sailing more than 90 degrees from the wind and the mark is on her leeward side. The rule does not apply before the starting signal (a boat has no proper course then), nor at a gate mark.",
		noteShort: "Gybe needed: downwind, mark on her leeward side.",
	},
	{
		id: "19.2a",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Obstruction: Right-of-Way Boat Choosing a Side",
		description: "A right-of-way boat may pass an obstruction on either side. If she changes course when choosing the side, she must give the other boat room to keep clear.",
		fullText: "", // TODO: official text of rule 19.2(a)
		laymanExplanation: "The boat with right of way chooses which side of the obstruction to pass. If she alters course while making that choice she must leave the other boat room to keep clear, so she cannot swing across her without warning.",
		note: "The choice of side itself is a permission, not modelled. The rule fires when the right-of-way boat is changing course (heading change over 0.5 degrees) while approaching an obstruction that the other boat is also approaching; that she is actually choosing a side is assumed.",
		noteShort: "Right-of-way boat turning near an obstruction.",
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
		description: "A boat that was clear astern and required to keep clear is not entitled to room under 19.2(b) if she becomes overlapped between the other boat and a continuing obstruction when there is no room to pass; while they remain overlapped she keeps clear and rules 10 and 11 do not apply.",
		fullText: "", // TODO: official text of rule 19.2(c)
		laymanExplanation: "A boat coming up from astern cannot force her way in between another boat and the obstruction. If at the moment she becomes overlapped there is not enough room for her to fit, the other boat does not have to give her room under 19.2(b), and the squeezing-in boat must keep clear for as long as they stay overlapped.",
		note: "At the moment the overlap begins, room is approximated as a gap of at least one beam (about 0.48 hull lengths) between the outside boat's hull and the obstruction's edge; the result is kept in engine memory while the overlap lasts. Every obstruction is treated as continuing. While it applies, the squeezing-in boat owes a keep-clear duty to the other boat, and the rule suspends 19.2(b), 10 and 11 between them.",
		noteShort: "Room = a beam's gap when the overlap began.",
	},
	{
		id: "20.2",
		part: 2,
		section: "C",
		evaluable: true,
		title: "Responding to a Hail",
		description: "A hailed boat must respond even if the hail breaks rule 20.1: by tacking as soon as possible, or by replying \"You tack\" and then giving the hailing boat room to tack and avoid her. Rule 18.2 does not apply between the boats from the hail until she has tacked and avoided.",
		fullText: "", // TODO: official text of rule 20.2
		laymanExplanation: "When a boat hails for room to tack, the hailed boat has to answer straight away, even if the hail should not have been made. Either she tacks as soon as she can, or she calls \"You tack\". After that reply she must give the hailing boat room, and the hailing boat must tack as soon as possible. While the hail is active the mark-room rule 18.2 does not apply between the two boats.",
		note: "Hails are made with the hail controls and stay until cleared (they do not expire). The rule fires for any hail between boats on the same tack, whether or not it breaks rule 20.1; the hail controls warn when 20.1 is broken (the hailer is not close-hauled or above, or is not approaching an obstruction). The need for a substantial course change, and the mark-fetching exception, are not modelled. Suspension of 18.2 ends when the boats are no longer on the same tack, not when the hailer has \"tacked and avoided\". Rules 20.1, 20.3 and 20.4 have no cards that fire.",
		noteShort: "Fires for any same-tack hail, valid or not; suspends 18.2.",
	},
	{
		id: "43.1b",
		part: 4,
		evaluable: true,
		title: "Exoneration: Sailing Within Room or Mark-Room",
		description: "A boat sailing within the room or mark-room she is entitled to is exonerated if, in an incident with the boat that must give it, she breaks a Section A rule or rule 15, 16 or 31.",
		fullText: "", // TODO: official text of rule 43.1(b)
		laymanExplanation: "If you are entitled to room or mark-room and, while sailing within it, you break one of the right-of-way rules (for example you fail to keep clear) in an incident with the boat that owed you that room, you are not penalised. Being exonerated does not give you right of way; it only protects you from a penalty.",
		note: "Applied after the other rules: whenever one boat owes room or mark-room to another, the other boat's Rule 10, 11, 12, 13, 15, 16.1 or 16.2 duty towards her is shown as exonerated. Whether she is actually sailing within the room is not checked, and rule 31 is not modelled. A duty to give room to keep clear (15, 16.1, 19.2(a)) is not an entitlement to room. Rule 43 was Rule 21 in the 2021-2024 edition.",
		noteShort: "Marks the entitled boat's right-of-way duties as exonerated.",
	},
];

/**
 * Reference-only rules: shown for context, not yet evaluated.
 * TODO: official text — `fullText` is empty until it is transcribed from the RRS.
 */
const REFERENCE_CONTENT: RuleContent[] = [
	{id: "1", part: 1, evaluable: false, title: "Safety", description: "Boats and competitors must help those in danger and carry life-saving equipment.", fullText: "", laymanExplanation: "Safety comes before the right-of-way rules: you must give all possible help to anyone in danger, and carry adequate life-saving equipment."},
	{id: "1.1", part: 1, evaluable: false, title: "Helping Those in Danger", description: "A boat, competitor or support person must give all possible help to any person or vessel in danger.", fullText: "", laymanExplanation: "If anyone is in danger you help, whatever the state of the race."},
	{id: "1.2", part: 1, evaluable: false, title: "Life-Saving Equipment and Personal Flotation Devices", description: "A boat must carry adequate life-saving equipment, and each competitor is responsible for wearing a personal flotation device adequate for the conditions.", fullText: "", laymanExplanation: "Carry enough life-saving gear for everyone on board and wear a lifejacket suited to the conditions."},
	{id: "2", part: 1, evaluable: false, title: "Fair Sailing", description: "Boats and owners must compete in compliance with recognized principles of sportsmanship and fair play.", fullText: "", laymanExplanation: "Race honestly and sportingly. A boat may only be penalised for breaking this rule if it is clearly established that she has done so."},
	{id: "3", part: 1, evaluable: false, title: "Decision to Race", description: "The responsibility for a boat's decision to participate in a race or to continue racing is hers alone.", fullText: "", laymanExplanation: "Only you can decide whether it is safe for your boat to start or to carry on racing."},
	{id: "4", part: 1, evaluable: false, title: "Acceptance of the Rules", description: "By taking part in an event, competitors, boat owners and support persons agree to be governed by the rules and to accept the penalties and decisions made under them.", fullText: "", laymanExplanation: "Taking part means you accept the racing rules and the decisions made under them, and agree to resolve disputes through the proper procedures rather than in a court."},
	{id: "16", part: 2, section: "B", evaluable: false, title: "Changing Course", description: "A right-of-way boat that changes course must give room; on a beat she must not bear away onto a port-tack boat passing to leeward.", fullText: "", laymanExplanation: "Rule 16 limits what a right-of-way boat may do: see 16.1 and 16.2."},
	{id: "18", part: 2, section: "C", evaluable: false, title: "Mark-Room", description: "Rules for giving room at a mark when boats are about to round or pass it.", fullText: "", laymanExplanation: "When boats are about to round or pass a mark on the same side, the rule decides who must give whom room to do it safely."},
	{id: "18.1", part: 2, section: "C", evaluable: false, title: "Mark-Room: When Rule 18 Applies", description: "Rule 18 applies between boats required to leave a mark on the same side when at least one is in the zone, except (1) on opposite tacks on a beat, (2) on opposite tacks when the proper course for one but not both is to tack, (3) between a boat approaching the mark and one leaving it, (4) at a continuing obstruction. Rule 18 no longer applies once mark-room has been given.", fullText: "", laymanExplanation: "Rule 18 only works when both boats must pass the mark on the same side and one of them is within three hull lengths. It does not apply between opposite-tack boats on a beat, between a boat coming to the mark and one leaving it, or at a mark that is a continuing obstruction (rule 19 applies there). Once mark-room has been given, rule 18 stops applying between the two boats.", note: "Modelled in the shared Rule 18 applicability test: exceptions (1) and (3) are applied. Exceptions (2) and (4) and 18.1(b) (Rule 18 ending once mark-room has been given) are not modelled. Section C rules skip every starting mark (the Section C preamble), always, because \"until they have left it astern\" is not modelled."},
	{id: "18.2b", part: 2, section: "C", evaluable: false, title: "Mark-Room: Ending the Entitlement", description: "Rule 18.2(a) no longer applies if the boat entitled to mark-room passes head to wind or leaves the zone.", fullText: "", laymanExplanation: "The duty fixed at the zone does not last forever: it stops when the boat entitled to mark-room tacks through the wind or leaves the three-hull-length zone. The simulator handles this by releasing its zone-entry memory, so it has no rule card of its own.", note: "Applied when the engine updates its zone-entry memory; there is no predicate. After release, 18.2(c) applies if the boats are overlapped."},
	{id: "18.2d", part: 2, section: "C", evaluable: false, title: "Mark-Room: Overlap Obtained Without Room", description: "If a boat obtained an inside overlap from clear astern or by tacking to windward and the outside boat has been unable to give mark-room since it began, rules 18.2(a) and 18.2(c) do not apply.", fullText: "", laymanExplanation: "A boat cannot win mark-room by squeezing in from astern, or by tacking to windward, if the outside boat was never able to give her room from the moment the overlap began.", note: "Not modelled."},
	{id: "18.2e", part: 2, section: "C", evaluable: false, title: "Mark-Room: Reasonable Doubt", description: "If there is reasonable doubt that a boat obtained or broke an overlap in time, it is presumed that she did not.", fullText: "", laymanExplanation: "When it is unclear whether an overlap was gained or broken in time, assume it was not.", note: "Not modelled."},
	{id: "19", part: 2, section: "C", evaluable: false, title: "Room to Pass an Obstruction", description: "Rules for giving room to pass an obstruction.", fullText: "", laymanExplanation: "When boats are sailing past an obstruction, the rule decides who must give room to whom."},
	{id: "19.1", part: 2, section: "C", evaluable: false, title: "Obstruction: When Rule 19 Applies", description: "Rule 19 applies between two boats at an obstruction except when rule 18 applies between them and the obstruction is the mark or another boat overlapped with each of them. At a continuing obstruction rule 19 always applies and rule 18 does not.", fullText: "", laymanExplanation: "The room-to-pass rules apply to boats about to pass an obstruction on the same side; where rule 18 already covers the mark, rule 18 decides instead. At a continuing obstruction only rule 19 applies.", note: "Marks are never obstructions in this model, and the exception for an obstruction that is another boat overlapped with each of them is not modelled. Every obstruction is treated as continuing, so rule 19 always applies at it."},
	{id: "20", part: 2, section: "C", evaluable: false, title: "Room to Tack at an Obstruction", description: "A boat may hail for room to tack to avoid an obstruction.", fullText: "", laymanExplanation: "A boat sailing close-hauled that needs to tack to avoid an obstruction may hail for room, and the hailed boat must respond."},
	{id: "20.1", part: 2, section: "C", evaluable: false, title: "Hailing", description: "A boat may hail \"Room to tack\" only if she is approaching an obstruction and will soon need a substantial course change to avoid it safely, and is sailing close-hauled or above; and not if the obstruction is a mark that a boat fetching it would have to change course for.", fullText: "", laymanExplanation: "The hailing boat calls for room to tack, and must be ready to tack at once. A hail is only allowed when she is sailing close-hauled or above, is approaching an obstruction and needs a substantial course change to avoid it safely. A hail that breaks the rule must still be answered (rule 20.2(b)); the hail controls warn when one of the first two conditions is not met.", note: "The first two conditions are checked by the hail controls (close-hauled or above, approaching an obstruction); the need for a substantial course change and the mark-fetching exception are not modelled."},
	{id: "20.3", part: 2, section: "C", evaluable: false, title: "Passing On a Hail to an Additional Boat", description: "A boat hailed for room to tack that intends to respond by tacking may hail another boat on the same tack, even if her hail does not meet the conditions of 20.1. Rule 20.2 applies between her and a boat she hails.", fullText: "", laymanExplanation: "If you have been hailed and are going to tack, you may pass the hail on to the next boat on your tack so that she gives you room too."},
	{id: "20.4", part: 2, section: "C", evaluable: false, title: "Additional Requirements for Hails", description: "When a hail may not be heard the boat must also make a signal that clearly indicates her need for room to tack or her response; the notice of race may specify an alternative communication.", fullText: "", laymanExplanation: "In noisy conditions or at a distance you must back up your hail with a clear signal, such as an arm movement, unless the notice of race prescribes another way of communicating.", note: "Not modelled."},
	{id: "21", part: 2, section: "D", evaluable: false, title: "Starting Errors; Taking Penalties; Backing a Sail", description: "A boat returning to the pre-start side after her starting signal, taking a penalty, or backing a sail must keep clear of boats not doing so. When rule 21 or 22 applies between two boats, Section A rules do not.", fullText: "", laymanExplanation: "A boat that is returning to the pre-start side, taking a penalty, or moving astern by backing a sail has to keep clear of other boats.", note: "Not modelled. Section D rules (21 and 22) displace Section A between two boats, so Rules 10 to 13 would not apply to them."},
	{id: "21.1", part: 2, section: "D", evaluable: false, title: "Sailing Towards the Pre-Start Side", description: "A boat sailing towards the pre-start side of the starting line or one of its extensions after her starting signal, to start or to comply with rule 30.1, keeps clear of a boat not doing so until her hull is completely on the pre-start side.", fullText: "", laymanExplanation: "A boat that started too early and is returning to start correctly must keep clear of boats that are not returning."},
	{id: "21.2", part: 2, section: "D", evaluable: false, title: "Taking a Penalty", description: "A boat taking a penalty keeps clear of one that is not.", fullText: "", laymanExplanation: "While you are doing your turns you must stay clear of boats that are not."},
	{id: "21.3", part: 2, section: "D", evaluable: false, title: "Backing a Sail", description: "A boat moving astern, or sideways to windward, through the water by backing a sail keeps clear of one that is not.", fullText: "", laymanExplanation: "A boat going backwards or sideways to windward by backing a sail must keep clear."},
	{id: "22", part: 2, section: "D", evaluable: false, title: "Capsized, Anchored or Aground; Rescuing", description: "If possible, a boat must avoid a boat that is capsized or has not regained control after capsizing, is anchored or aground, or is trying to help a person or vessel in danger.", fullText: "", laymanExplanation: "Keep out of the way of a boat that is capsized, anchored, aground or going to someone's help."},
	{id: "23", part: 2, section: "D", evaluable: false, title: "Interfering with Another Boat", description: "A boat not racing must not interfere with a boat that is racing, and no boat may interfere with a boat taking a penalty, sailing on another leg or subject to rule 21.1.", fullText: "", laymanExplanation: "If you are not racing, stay out of the way of those who are; and avoid getting in the way of boats doing penalty turns, sailing a different leg or returning to start."},
	{id: "23.1", part: 2, section: "D", evaluable: false, title: "Boats Not Racing", description: "If reasonably possible, a boat not racing shall not interfere with a boat that is racing.", fullText: "", laymanExplanation: "A boat that is not racing must keep out of the way of boats that are."},
	{id: "23.2", part: 2, section: "D", evaluable: false, title: "Boats Taking a Penalty or Sailing on Another Leg", description: "If reasonably possible, a boat shall not interfere with a boat that is taking a penalty, sailing on another leg or subject to rule 21.1; after the starting signal this does not apply when she is sailing her proper course.", fullText: "", laymanExplanation: "Do not get in the way of boats doing turns, on a different leg or returning to start, unless you are sailing your proper course after the start."},
	{id: "30", part: 3, evaluable: false, title: "Starting Penalties", description: "Penalties for being too close to the starting line near the start: the I, Z, U and black flag rules.", fullText: "", laymanExplanation: "Boats that are on the course side of the starting line near the start may have to return and start correctly, or accept a penalty or disqualification, depending on the flag displayed."},
	{id: "30.1", part: 3, evaluable: false, title: "I Flag Rule", description: "With flag I displayed, a boat with any part of her hull on the course side of the starting line or an extension in the last minute must sail across an extension to the pre-start side before starting.", fullText: "", laymanExplanation: "If you are over the line in the last minute under the I flag, you must go back around the end of the line before you start."},
	{id: "30.2", part: 3, evaluable: false, title: "Z Flag Rule", description: "With flag Z displayed, no part of a boat's hull may be in the triangle formed by the ends of the starting line and the first mark in the last minute; an identified boat receives a scoring penalty without a hearing.", fullText: "", laymanExplanation: "Stay out of the triangle in the last minute under the Z flag or take a scoring penalty."},
	{id: "30.3", part: 3, evaluable: false, title: "U Flag Rule", description: "With flag U displayed, no part of a boat's hull may be in the triangle formed by the ends of the starting line and the first mark in the last minute; an identified boat is disqualified without a hearing, unless the race is restarted or resailed.", fullText: "", laymanExplanation: "Stay out of the triangle in the last minute under the U flag or be disqualified."},
	{id: "30.4", part: 3, evaluable: false, title: "Black Flag Rule", description: "With a black flag displayed, no part of a boat's hull may be in the triangle formed by the ends of the starting line and the first mark in the last minute; an identified boat is disqualified without a hearing, even if the race is restarted or resailed.", fullText: "", laymanExplanation: "Stay out of the triangle in the last minute under the black flag or be disqualified, even if the race is restarted."},
	{id: "31", part: 3, evaluable: false, title: "Touching a Mark", description: "While racing, a boat shall not touch a starting mark before starting, a mark that begins, bounds or ends the leg of the course she is sailing, or a finishing mark after finishing.", fullText: "", laymanExplanation: "If you touch a mark of the course you must take a penalty by promptly doing a turns penalty.", note: "Not modelled."},
	{id: "42", part: 4, evaluable: false, title: "Propulsion", description: "A boat shall compete by using only the wind and water to increase, maintain or decrease her speed.", fullText: "", laymanExplanation: "You can only use the wind and the water to drive the boat. Pumping, rocking and sculling are generally not allowed except where the rule specifically permits."},
	{id: "43", part: 4, evaluable: false, title: "Exoneration", description: "A boat that breaks a rule is exonerated in the situations listed in 43.1, and an exonerated boat need not take a penalty.", fullText: "", laymanExplanation: "In some situations a boat that breaks a rule is not penalised, for example when she was forced to by another boat's breach, or while sailing within the room she is entitled to.", note: "The 2025-2028 edition moved exoneration here from rule 21. Only 43.1(b) is evaluated."},
	{id: "43.1a", part: 4, evaluable: false, title: "Exoneration: Compelled Breach", description: "When as a consequence of breaking a rule a boat has compelled another boat to break a rule, the other boat is exonerated for her breach.", fullText: "", laymanExplanation: "If another boat's breach forced you to break a rule, you are not penalised for it.", note: "Not modelled."},
	{id: "43.1c", part: 4, evaluable: false, title: "Exoneration: No Damage or Injury", description: "A right-of-way boat, or one sailing within the room or mark-room to which she is entitled, is exonerated for breaking rule 14 if the contact does not cause damage or injury.", fullText: "", laymanExplanation: "Having right of way, or being entitled to room, protects you from a penalty for rule 14 when the contact is harmless.", note: "Not modelled."},
	{id: "43.2", part: 4, evaluable: false, title: "Exoneration: No Penalty", description: "A boat exonerated for breaking a rule need not take a penalty and shall not be penalized for breaking that rule.", fullText: "", laymanExplanation: "An exonerated boat does not have to do turns and cannot be penalised in a protest for that breach."},
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
