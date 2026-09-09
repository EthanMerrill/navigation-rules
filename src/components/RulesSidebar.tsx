import {useEffect, useMemo, useRef, useState} from "react";
import {motion} from "motion/react";
import "../styles/styles.css";
import {RuleEvaluation, RuleState} from "../rules/rulesEngine";
import {CooldownState, useCooldowns} from "../hooks/useCooldowns";
import RuleModal from "./RuleModal";

interface RulesSidebarProps {
	evaluation: RuleEvaluation;
}

const RulesSidebar = ({evaluation}: RulesSidebarProps) => {
	const [selectedRule, setSelectedRule] = useState<RuleState | null>(null);
	const cooldowns = useCooldowns(evaluation);

	// A cooling-down rule is no longer engine-applicable (so the engine sorts it
	// with the inactive rules), but the UI still shows it as active. Re-order so
	// it stays in the active group, at the bottom of the active rules.
	const orderedRules = useMemo(() => {
		const isActive = (rule: RuleState) => rule.applicable || cooldowns[rule.ruleNumber]?.active === true;
		const byNumber = (a: RuleState, b: RuleState) => a.ruleNumber - b.ruleNumber;

		const deciding = evaluation.rules.filter((rule) => rule.deciding);
		const active = evaluation.rules.filter((rule) => !rule.deciding && isActive(rule)).sort(byNumber);
		const inactive = evaluation.rules.filter((rule) => !rule.deciding && !isActive(rule)).sort(byNumber);

		return [...deciding, ...active, ...inactive];
	}, [evaluation.rules, cooldowns]);

	return (
		<div className="rules-sidebar">
			<div className="rules-sidebar__header" style={{width: "100%"}}>
				<h2>Right-of-Way Rules</h2>
				<p>These rules determine which boat has the right of way (stand-on) and which boat must keep clear (give-way). The boat with a green shadow has the right of way. Click a rule to read its full text.</p>
			</div>
			<div className="rules-sidebar__content">
				{orderedRules.map((rule) => (
					<RuleCard key={rule.ruleNumber} rule={rule} collided={evaluation.collided} cooldown={rule.cooldownMs !== undefined ? cooldowns[rule.ruleNumber] : undefined} onSelect={setSelectedRule} />
				))}
			</div>
			<RuleModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
		</div>
	);
};

/** How long the reorder (layout) animation takes before a card expands. */
const REORDER_DELAY = 0.28;

const RuleCard = ({rule, collided, cooldown, onSelect}: {rule: RuleState; collided?: boolean; cooldown?: CooldownState; onSelect: (rule: RuleState) => void}) => {
	// A cooldown rule stays visibly "applicable" while its cooldown is still
	// counting down, even after the engine has already reported it not-applicable.
	const applicable = cooldown ? cooldown.active || rule.applicable : rule.applicable;

	// Detect whether this card is about to *expand* (become applicable) so we can
	// sequence its expansion after the layout reorder finishes.
	const prevApplicable = useRef(applicable);
	const expanding = applicable && !prevApplicable.current;
	useEffect(() => {
		prevApplicable.current = applicable;
	});

	const className = ["rule-card", rule.deciding ? "rule-card--deciding" : "", applicable && !rule.deciding ? "rule-card--applicable" : "", !applicable ? "rule-card--inactive" : ""].filter(Boolean).join(" ");

	return (
		<motion.div layout className={className} onClick={() => onSelect(rule)} transition={{type: "spring", stiffness: 500, damping: 34}}>
			<div className="rule-card__header">
				<h3 className="rule-card__title">
					Rule {rule.ruleNumber} — {rule.title}
				</h3>
				{rule.deciding && <span className="rule-card__badge">Deciding</span>}
				{applicable && !rule.deciding && !(collided && rule.ruleNumber === 14) && <span className="rule-card__badge rule-card__badge--applicable">Applies</span>}
				{collided && rule.ruleNumber === 14 && <span className="rule-card__badge rule-card__badge--collision">Collision</span>}
			</div>
			<motion.div
				className="rule-card__body"
				initial={false}
				animate={{height: applicable ? "auto" : 0, opacity: applicable ? 1 : 0}}
				transition={{
					type: "spring",
					stiffness: 400,
					damping: 32,
					// When expanding, wait for the card to finish moving into place first.
					delay: expanding ? REORDER_DELAY : 0,
				}}>
				<div className="rule-card__body-inner">
					<p className="rule-card__description">{rule.description}</p>
					{rule.applicable && <p className="rule-card__detail">{rule.detail}</p>}
					{applicable && rule.noteShort && <p className="rule-card__note">{rule.noteShort}</p>}
				</div>
			</motion.div>
			{cooldown?.active && <CooldownIndicator key={cooldown.key} durationMs={cooldown.durationMs} />}
		</motion.div>
	);
};

/**
 * A reverse loading circle, pinned to the card's bottom-right, that drains from
 * full → half → empty over the cooldown duration. The `key` on the parent remounts
 * it on each (re-)fire so the animation restarts from full.
 */
const CooldownIndicator = ({durationMs}: {durationMs: number}) => {
	const RADIUS = 9;
	const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

	return (
		<svg className="rule-card__cooldown" viewBox="0 0 24 24" aria-hidden="true">
			<circle className="rule-card__cooldown-track" cx="12" cy="12" r={RADIUS} />
			<circle className="rule-card__cooldown-fill" cx="12" cy="12" r={RADIUS} strokeDasharray={CIRCUMFERENCE} style={{animationDuration: `${durationMs}ms`}} />
		</svg>
	);
};

export default RulesSidebar;
