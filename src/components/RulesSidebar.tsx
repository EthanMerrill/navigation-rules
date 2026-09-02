import {useEffect, useRef, useState} from "react";
import {motion} from "motion/react";
import "../styles/styles.css";
import {RuleEvaluation, RuleState} from "../rules/rulesEngine";
import RuleModal from "./RuleModal";

interface RulesSidebarProps {
	evaluation: RuleEvaluation;
}

const RulesSidebar = ({evaluation}: RulesSidebarProps) => {
	const [selectedRule, setSelectedRule] = useState<RuleState | null>(null);

	return (
		<div className="rules-sidebar">
			<div className="rules-sidebar__header" style={{width: "100%"}}>
				<h2>Right-of-Way Rules</h2>
				<p>These rules determine which boat has the right of way (stand-on) and which boat must keep clear (give-way). The boat with a green shadow has the right of way. Click a rule to read its full text.</p>
			</div>
			<div className="rules-sidebar__content">
				{evaluation.rules.map((rule) => (
					<RuleCard key={rule.ruleNumber} rule={rule} onSelect={setSelectedRule} />
				))}
			</div>
			<RuleModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
		</div>
	);
};

/** How long the reorder (layout) animation takes before a card expands. */
const REORDER_DELAY = 0.28;

const RuleCard = ({rule, onSelect}: {rule: RuleState; onSelect: (rule: RuleState) => void}) => {
	// Detect whether this card is about to *expand* (become applicable) so we can
	// sequence its expansion after the layout reorder finishes.
	const prevApplicable = useRef(rule.applicable);
	const expanding = rule.applicable && !prevApplicable.current;
	useEffect(() => {
		prevApplicable.current = rule.applicable;
	});

	const className = ["rule-card", rule.deciding ? "rule-card--deciding" : "", rule.applicable && !rule.deciding ? "rule-card--applicable" : "", !rule.applicable ? "rule-card--inactive" : ""].filter(Boolean).join(" ");

	return (
		<motion.div layout className={className} onClick={() => onSelect(rule)} transition={{type: "spring", stiffness: 500, damping: 34}}>
			<div className="rule-card__header">
				<h3 className="rule-card__title">
					Rule {rule.ruleNumber} — {rule.title}
				</h3>
				{rule.deciding && <span className="rule-card__badge">Deciding</span>}
				{rule.applicable && !rule.deciding && <span className="rule-card__badge rule-card__badge--applicable">Applies</span>}
			</div>
			<motion.div
				className="rule-card__body"
				initial={false}
				animate={{height: rule.applicable ? "auto" : 0, opacity: rule.applicable ? 1 : 0}}
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
				</div>
			</motion.div>
		</motion.div>
	);
};

export default RulesSidebar;
