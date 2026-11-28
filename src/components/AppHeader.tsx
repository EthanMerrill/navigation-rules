import type {ReactNode} from "react";
import {SCENARIOS} from "../scenarios";

interface AppHeaderProps {
	/** Id of the loaded scenario; "" for the default scene. */
	scenarioId: string;
	/** True once boats or marks have been added or removed: the picker shows "Custom scenario". */
	custom?: boolean;
	/** Called with a scenario id, or "" for the default scene. */
	onScenarioChange: (id: string) => void;
	/** Reload the current scenario. */
	onReset: () => void;
	/** Extra control rows shown below the scenario picker (the add tray, and the hail controls when relevant). */
	children?: ReactNode;
}

/** Picker value for an edited scene; never a scenario id. */
const CUSTOM_VALUE = "__custom";

const AppHeader = ({scenarioId, custom = false, onScenarioChange, onReset, children}: AppHeaderProps) => {
	return (
		<header className="app-header">
			<div className="control-bar">
				<div className="control-row">
					<label className="control-label" htmlFor="scenario-picker">
						Scenario
					</label>
					<select id="scenario-picker" className="scenario-picker" value={custom ? CUSTOM_VALUE : scenarioId} onChange={(e) => onScenarioChange(e.target.value)}>
						{custom && (
							<option value={CUSTOM_VALUE} disabled>
								Custom scenario
							</option>
						)}
						<option value="">Default scene</option>
						{SCENARIOS.map((scenario) => (
							<option key={scenario.id} value={scenario.id}>
								{scenario.title}
							</option>
						))}
					</select>
					<button type="button" className="reset-button" onClick={onReset} title={custom ? "Undo your changes: reload the scenario" : "Reload the scenario"}>
						Reset
					</button>
				</div>
				{children}
			</div>
		</header>
	);
};

export default AppHeader;
