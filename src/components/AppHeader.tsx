import type {ReactNode} from "react";
import {SCENARIOS} from "../scenarios";

interface AppHeaderProps {
	/** Id of the loaded scenario; "" for the default scene. */
	scenarioId: string;
	/** Called with a scenario id, or "" for the default scene. */
	onScenarioChange: (id: string) => void;
	/** Reload the current scenario. */
	onReset: () => void;
	/** Extra control rows shown below the scenario picker (the hail controls, when relevant). */
	children?: ReactNode;
}

const AppHeader = ({scenarioId, onScenarioChange, onReset, children}: AppHeaderProps) => {
	return (
		<header className="app-header">
			<div className="control-bar">
				<div className="control-row">
					<label className="control-label" htmlFor="scenario-picker">
						Scenario
					</label>
					<select id="scenario-picker" className="scenario-picker" value={scenarioId} onChange={(e) => onScenarioChange(e.target.value)}>
						<option value="">Default scene</option>
						{SCENARIOS.map((scenario) => (
							<option key={scenario.id} value={scenario.id}>
								{scenario.title}
							</option>
						))}
					</select>
					<button type="button" className="reset-button" onClick={onReset}>
						Reset
					</button>
				</div>
				{children}
			</div>
		</header>
	);
};

export default AppHeader;
