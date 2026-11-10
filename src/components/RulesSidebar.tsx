import type React from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import {motion} from "motion/react";
import "../styles/styles.css";
import {RuleContent, RuleEvaluation, RuleState, compareRuleIds} from "../rules/rulesEngine";
import {CooldownState, useCooldowns} from "../hooks/useCooldowns";
import {useCollapsedGroups} from "../hooks/useCollapsedGroups";
import {displayOf, isShownApplicable} from "../ui/ruleDisplay";
import {REFERENCE_GROUP_KEY, groupRules} from "../ui/ruleGroups";
import RuleModal, {RuleModalRule} from "./RuleModal";

interface RulesSidebarProps {
	evaluation: RuleEvaluation;
}

const RulesSidebar = ({evaluation}: RulesSidebarProps) => {
	const [selectedRule, setSelectedRule] = useState<RuleModalRule | null>(null);
	const {isCollapsed, toggle} = useCollapsedGroups([REFERENCE_GROUP_KEY]);
	const cooldowns = useCooldowns(evaluation);

	// Rules that always apply (Rule 14) only count as applicable in the sidebar
	// when the focus pair is close or has collided.
	const focusPair = evaluation.focusPair ? evaluation.pairs[evaluation.focusPair] : null;
	const shownRules = useMemo(() => evaluation.rules.map((rule) => ({...rule, applicable: isShownApplicable(rule, focusPair)})), [evaluation.rules, focusPair]);

	// A cooling-down rule is no longer engine-applicable (so the engine sorts it
	// with the inactive rules), but the UI still shows it as active. Re-order so
	// it stays in the active group, at the bottom of the active rules.
	const orderedRules = useMemo(() => {
		const isActive = (rule: RuleState) => rule.applicable || cooldowns[rule.id]?.active === true;
		const byId = (a: RuleState, b: RuleState) => compareRuleIds(a.id, b.id);

		const deciding = shownRules.filter((rule) => rule.deciding);
		const active = shownRules.filter((rule) => !rule.deciding && isActive(rule)).sort(byId);
		const inactive = shownRules.filter((rule) => !rule.deciding && !isActive(rule)).sort(byId);

		return [...deciding, ...active, ...inactive];
	}, [shownRules, cooldowns]);

	// Group by Part/Section; the ordering above is kept within each group.
	const groups = useMemo(() => groupRules(orderedRules), [orderedRules]);
	const isActive = (rule: RuleState) => rule.applicable || cooldowns[rule.id]?.active === true;

	const collided = Object.values(evaluation.pairs).some((pair) => pair.collided);

	return (
		<div className="rules-sidebar">
			<div className="rules-sidebar__header" style={{width: "100%"}}>
				<h2>Right-of-Way Rules</h2>
				<p>These rules determine which boat has the right of way (stand-on) and which boat must keep clear (give-way). The boat with a green shadow has the right of way. Click a rule to read its full text.</p>
			</div>
			<div className="rules-sidebar__content">
				{groups.map((group) => {
					const activeCount = group.rules.filter(isActive).length;
					return (
						<RuleGroupSection key={group.key} groupKey={group.key} title={group.title} count={`${activeCount} active`} highlighted={activeCount > 0} collapsed={isCollapsed(group.key)} onToggle={toggle}>
							{group.rules.map((rule) => (
								<RuleCard key={rule.id} rule={rule} collided={collided} cooldown={displayOf(rule.id).cooldownMs !== undefined ? cooldowns[rule.id] : undefined} onSelect={setSelectedRule} />
							))}
						</RuleGroupSection>
					);
				})}
				<RuleGroupSection groupKey={REFERENCE_GROUP_KEY} title="Other rules (reference only)" count={`${evaluation.referenceRules.length} rules`} collapsed={isCollapsed(REFERENCE_GROUP_KEY)} onToggle={toggle}>
					{evaluation.referenceRules.map((rule) => (
						<ReferenceRuleCard key={rule.id} rule={rule} onSelect={setSelectedRule} />
					))}
				</RuleGroupSection>
			</div>
			<RuleModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
		</div>
	);
};

interface RuleGroupSectionProps {
	groupKey: string;
	title: string;
	/** Badge text, e.g. "2 active". */
	count: string;
	/** Style the badge as having activity. */
	highlighted?: boolean;
	collapsed: boolean;
	onToggle: (key: string) => void;
	children: React.ReactNode;
}

/** A collapsible group of rule cards under a header button. */
const RuleGroupSection = ({groupKey, title, count, highlighted, collapsed, onToggle, children}: RuleGroupSectionProps) => (
	<section className="rule-group">
		<button type="button" className="rule-group__header" aria-expanded={!collapsed} onClick={() => onToggle(groupKey)}>
			<span className="rule-group__chevron" aria-hidden="true">
				{collapsed ? "▸" : "▾"}
			</span>
			<span className="rule-group__title">{title}</span>
			<span className={highlighted ? "rule-group__count rule-group__count--active" : "rule-group__count"}>{count}</span>
		</button>
		{!collapsed && <div className="rule-group__rules">{children}</div>}
	</section>
);

/** A compact, non-expandable card for a reference-only rule; click opens the modal. */
const ReferenceRuleCard = ({rule, onSelect}: {rule: RuleContent; onSelect: (rule: RuleModalRule) => void}) => (
	<button type="button" className="rule-card rule-card--reference" onClick={() => onSelect(rule)}>
		<h3 className="rule-card__title">
			Rule {rule.id} — {rule.title}
		</h3>
	</button>
);

/** How long the reorder (layout) animation takes before a card expands. */
const REORDER_DELAY = 0.28;

const RuleCard = ({rule, collided, cooldown, onSelect}: {rule: RuleState; collided?: boolean; cooldown?: CooldownState; onSelect: (rule: RuleModalRule) => void}) => {
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
					Rule {rule.id} — {rule.title}
				</h3>
				{rule.deciding && <span className="rule-card__badge">Deciding</span>}
				{applicable && !rule.deciding && !(collided && rule.id === "14") && <span className="rule-card__badge rule-card__badge--applicable">Applies</span>}
				{collided && rule.id === "14" && <span className="rule-card__badge rule-card__badge--collision">Collision</span>}
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
