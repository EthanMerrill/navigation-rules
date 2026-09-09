import {useEffect} from "react";
import {createPortal} from "react-dom";
import {motion, AnimatePresence} from "motion/react";
import {RuleState} from "../rules/rulesEngine";

interface RuleModalProps {
	rule: RuleState | null;
	onClose: () => void;
}

const RuleModal = ({rule, onClose}: RuleModalProps) => {
	useEffect(() => {
		if (!rule) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [rule, onClose]);

	return createPortal(
		<AnimatePresence>
			{rule && (
				<motion.div className="rule-modal__backdrop" onClick={onClose} initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} transition={{duration: 0.2}}>
					<motion.div
						className="rule-modal"
						role="dialog"
						aria-modal="true"
						aria-labelledby="rule-modal-title"
						onClick={(e) => e.stopPropagation()}
						initial={{opacity: 0, y: 24, scale: 0.96}}
						animate={{opacity: 1, y: 0, scale: 1}}
						exit={{opacity: 0, y: 24, scale: 0.96}}
						transition={{type: "spring", stiffness: 350, damping: 30}}>
						<div className="rule-modal__header">
							<h2 id="rule-modal-title">
								Rule {rule.ruleNumber} — {rule.title}
							</h2>
							<button type="button" className="rule-modal__close" onClick={onClose} aria-label="Close">
								×
							</button>
						</div>
						<div className="rule-modal__body">
							<p className="rule-modal__short">{rule.description}</p>

							<section>
								<h3>Official text</h3>
								<blockquote className="rule-modal__full-text">{rule.fullText}</blockquote>
							</section>

							<section>
								<h3>In plain English</h3>
								<p className="rule-modal__layman">{rule.laymanExplanation}</p>
							</section>

							{rule.note && (
								<section>
									<h3>Note</h3>
									<p className="rule-modal__note">{rule.note}</p>
								</section>
							)}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	);
};

export default RuleModal;
