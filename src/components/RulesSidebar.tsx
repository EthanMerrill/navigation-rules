import type React from "react";
import {useEffect, useId, useMemo, useRef, useState} from "react";
import {motion} from "motion/react";
import "../styles/styles.css";
import {RuleContent, RuleEvaluation, RuleState, compareRuleIds, formatRuleId} from "../rules/rulesEngine";
import {CooldownState, useCooldowns} from "../hooks/useCooldowns";
import {useCollapsedGroups} from "../hooks/useCollapsedGroups";
import {useSettled} from "../hooks/useSettled";
import {useSheetDrag} from "../hooks/useSheetDrag";
import {displayOf, isShownApplicable} from "../ui/ruleDisplay";
import {REFERENCE_GROUP_KEY, groupRules} from "../ui/ruleGroups";
import RuleModal, {RuleModalRule} from "./RuleModal";

interface RulesSidebarProps {
	/** The live evaluation; the sidebar shows it once it has settled. */
	evaluation: RuleEvaluation;
	/** True while the pointer is held down on the water (a drag may be in progress). */
	interacting?: boolean;
	/** Changes when a scenario is loaded: the sidebar shows the new rules at once instead of settling. */
	resetKey?: unknown;
}

/** A rule as the sidebar shows it. */
interface SidebarRule extends RuleState {
	/** Applicable, or still cooling down after it fired. */
	active: boolean;
	cooldown?: CooldownState;
}

/** Everything the sidebar draws, so it can be held still while things settle. */
interface SidebarModel {
	/** Deciding rule first, then other active rules by id, then the rest by id. */
	rules: SidebarRule[];
	collided: boolean;
}

const VIEW_STORAGE_KEY = "rules-sidebar.view";
type SidebarView = "active" | "all";

function readView(): SidebarView {
	try {
		return window.localStorage.getItem(VIEW_STORAGE_KEY) === "all" ? "all" : "active";
	} catch {
		return "active";
	}
}

function buildModel(evaluation: RuleEvaluation, cooldowns: Record<string, CooldownState>): SidebarModel {
	// Rules that always apply (Rule 14) only count as applicable when the focus pair is close or has collided.
	const focusPair = evaluation.focusPair ? evaluation.pairs[evaluation.focusPair] : null;
	const rules: SidebarRule[] = evaluation.rules.map((rule) => {
		const applicable = isShownApplicable(rule, focusPair);
		const cooldown = displayOf(rule.id).cooldownMs !== undefined ? cooldowns[rule.id] : undefined;
		// A cooling-down rule is no longer engine-applicable, but still shows as active.
		return {...rule, applicable, active: applicable || cooldown?.active === true, cooldown};
	});
	const byId = (a: SidebarRule, b: SidebarRule) => compareRuleIds(a.id, b.id);
	const deciding = rules.filter((rule) => rule.deciding);
	const active = rules.filter((rule) => !rule.deciding && rule.active).sort(byId);
	const inactive = rules.filter((rule) => !rule.deciding && !rule.active).sort(byId);
	return {rules: [...deciding, ...active, ...inactive], collided: Object.values(evaluation.pairs).some((pair) => pair.collided)};
}

/** What has to change before the sidebar re-sorts: which rules are deciding or active, in order. */
function signatureOf(model: SidebarModel): string {
	return model.rules.map((rule) => `${rule.id}:${rule.deciding ? "d" : rule.active ? "a" : "-"}`).join(",") + (model.collided ? "|x" : "");
}

const RulesSidebar = ({evaluation, interacting = false, resetKey}: RulesSidebarProps) => {
	const [selectedRule, setSelectedRule] = useState<RuleModalRule | null>(null);
	const [view, setView] = useState<SidebarView>(readView);
	const [sheetOpen, setSheetOpen] = useState(false);
	const sheetRef = useRef<HTMLElement>(null);
	const {dragHeight, handleProps} = useSheetDrag(sheetRef, sheetOpen, setSheetOpen);
	const {isCollapsed, toggle} = useCollapsedGroups([REFERENCE_GROUP_KEY]);
	const cooldowns = useCooldowns(evaluation);

	const live = useMemo(() => buildModel(evaluation, cooldowns), [evaluation, cooldowns]);
	const {value: model, settling} = useSettled(live, signatureOf(live), live, interacting, resetKey);

	const activeCount = model.rules.filter((rule) => rule.active).length;
	const shownRules = view === "all" ? model.rules : model.rules.filter((rule) => rule.active);
	const groups = groupRules(shownRules);

	const chooseView = (next: SidebarView) => {
		setView(next);
		try {
			window.localStorage.setItem(VIEW_STORAGE_KEY, next);
		} catch {
			// Not persisted; the in-memory choice still works.
		}
	};

	return (
		<aside
			ref={sheetRef}
			className={`rules-sidebar${sheetOpen ? " rules-sidebar--sheet-open" : ""}${dragHeight !== null ? " rules-sidebar--dragging" : ""}`}
			style={dragHeight !== null ? {maxHeight: dragHeight} : undefined}
			aria-label="Rules">
			<div className="rules-sidebar__header">
				<button type="button" className="rules-sidebar__sheet-toggle" aria-expanded={sheetOpen} {...handleProps}>
					<span className="rules-sidebar__sheet-grip" aria-hidden="true" />
					<span className="visually-hidden">{sheetOpen ? "Hide rules" : "Show rules"}</span>
				</button>
				<div className="rules-sidebar__title-row">
					<h2>Right-of-Way Rules</h2>
					<InfoButton />
					<span className="rules-sidebar__sheet-count">{activeCount} active</span>
				</div>
				<div className="rules-sidebar__toolbar">
					<div className="segmented" role="group" aria-label="Which rules to list">
						<button type="button" className="segmented__option" aria-pressed={view === "active"} onClick={() => chooseView("active")}>
							Active <span className="segmented__count">{activeCount}</span>
						</button>
						<button type="button" className="segmented__option" aria-pressed={view === "all"} onClick={() => chooseView("all")}>
							All rules
						</button>
					</div>
					<span className={`rules-sidebar__status${settling ? " rules-sidebar__status--visible" : ""}`} role="status">
						{settling ? "Recalculating…" : ""}
					</span>
				</div>
				<div className={`rules-sidebar__progress${settling ? " rules-sidebar__progress--visible" : ""}`} aria-hidden="true" />
			</div>
			<div className={`rules-sidebar__content${settling ? " rules-sidebar__content--settling" : ""}`} aria-busy={settling}>
				{groups.length === 0 && <p className="rules-sidebar__empty">No rules apply right now. Bring two boats together to see who has right of way.</p>}
				{groups.map((group) => {
					const groupActive = group.rules.filter((rule) => rule.active).length;
					return (
						<RuleGroupSection key={group.key} groupKey={group.key} title={group.title} count={`${groupActive} active`} highlighted={groupActive > 0} collapsed={isCollapsed(group.key)} onToggle={toggle}>
							{group.rules.map((rule) => (
								<RuleCard key={rule.id} rule={rule} collided={model.collided} onSelect={setSelectedRule} />
							))}
						</RuleGroupSection>
					);
				})}
				{view === "all" && (
					<RuleGroupSection groupKey={REFERENCE_GROUP_KEY} title="Other rules (reference only)" count={`${evaluation.referenceRules.length} rules`} collapsed={isCollapsed(REFERENCE_GROUP_KEY)} onToggle={toggle}>
						{evaluation.referenceRules.map((rule) => (
							<ReferenceRuleCard key={rule.id} rule={rule} onSelect={setSelectedRule} />
						))}
					</RuleGroupSection>
				)}
			</div>
			<RuleModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
		</aside>
	);
};

/** The ⓘ button by the title: what the sidebar and the colours on the water mean. */
const InfoButton = () => {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	const popoverId = useId();

	useEffect(() => {
		if (!open) return;
		const onPointer = (e: PointerEvent) => {
			if (!ref.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div className="info" ref={ref}>
			<button type="button" className="info__button" aria-label="About these rules" aria-expanded={open} aria-controls={popoverId} onClick={() => setOpen((o) => !o)}>
				<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
					<circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
					<circle cx="10" cy="6.2" r="1.1" fill="currentColor" />
					<path d="M10 9v5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
				</svg>
			</button>
			{open && (
				<div className="info__popover" id={popoverId} role="dialog" aria-label="About these rules">
					<p>These rules decide which boat has right of way and which must keep clear. Click a rule to read its full text.</p>
					<ul className="info__legend">
						<li>
							<span className="info__swatch info__swatch--right-of-way" /> Green outline: right of way
						</li>
						<li>
							<span className="info__swatch info__swatch--keep-clear" /> Red outline: must keep clear
						</li>
						<li>
							<span className="info__swatch info__swatch--entitled" /> Blue: room or mark-room she is owed
						</li>
						<li>
							<span className="info__swatch info__swatch--duty" /> Purple: room, mark-room or a tack she owes
						</li>
						<li>
							<span className="info__swatch info__swatch--limitation" /> Grey: a limit on how she may sail
						</li>
					</ul>
				</div>
			)}
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
			Rule {formatRuleId(rule.id)} — {rule.title}
		</h3>
	</button>
);

/** How long the reorder (layout) animation takes before a card expands. */
const REORDER_DELAY = 0.28;

const RuleCard = ({rule, collided, onSelect}: {rule: SidebarRule; collided?: boolean; onSelect: (rule: RuleModalRule) => void}) => {
	const {active, cooldown} = rule;

	// Detect whether this card is about to *expand* (become active) so we can
	// sequence its expansion after the layout reorder finishes.
	const prevActive = useRef(active);
	const expanding = active && !prevActive.current;
	useEffect(() => {
		prevActive.current = active;
	});

	const className = ["rule-card", rule.deciding ? "rule-card--deciding" : "", active && !rule.deciding ? "rule-card--applicable" : "", !active ? "rule-card--inactive" : ""].filter(Boolean).join(" ");

	return (
		<motion.div layout className={className} onClick={() => onSelect(rule)} transition={{type: "spring", stiffness: 500, damping: 34}}>
			<div className="rule-card__header">
				<h3 className="rule-card__title">
					Rule {formatRuleId(rule.id)} — {rule.title}
				</h3>
				{rule.deciding && <span className="rule-card__badge">Deciding</span>}
				{active && !rule.deciding && !(collided && rule.id === "14") && <span className="rule-card__badge rule-card__badge--applicable">Applies</span>}
				{collided && rule.id === "14" && <span className="rule-card__badge rule-card__badge--collision">Collision</span>}
			</div>
			<motion.div
				className="rule-card__body"
				initial={false}
				animate={{height: active ? "auto" : 0, opacity: active ? 1 : 0}}
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
					{active && rule.noteShort && <p className="rule-card__note">{rule.noteShort}</p>}
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
