import {useReducer} from "react";
import "./App.css";
import "./styles/styles.css";
import RulesSidebar from "./components/RulesSidebar";
import AppHeader from "./components/AppHeader";
import MoveableBoat from "./components/MoveableBoat";
import TransomLineOverlay from "./components/TransomLineOverlay";
import {createDefaultWorld, worldReducer} from "./state/worldReducer";
import {useRulesEngine} from "./hooks/useRulesEngine";

function App() {
	const [world, dispatch] = useReducer(worldReducer, undefined, createDefaultWorld);

	// TEMPORARY (Phase 1): the engine evaluates the first two boats only.
	const evaluation = useRulesEngine(world);
	const [boatA, boatB] = world.boats;

	return (
		<div className="App">
			<div className="patterns pt1"></div>
			<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');</style>
			<AppHeader wind={world.wind} onWindChange={(direction) => dispatch({type: "setWind", direction})} boats={world.boats} onToggleTacking={(id) => dispatch({type: "toggleTacking", id})} />
			{evaluation && <RulesSidebar evaluation={evaluation} />}
			{world.boats.map((boat, index) => {
				// Only the first two boats have a rule view until Phase 2.
				const view = evaluation && index < 2 ? evaluation.boats[index] : null;
				return (
					<div className="draggable" key={boat.id}>
						{view && <MoveableBoat boatState={boat} dispatch={dispatch} text={boat.id} boatRuleView={view} />}
					</div>
				);
			})}
			{evaluation && <TransomLineOverlay boatA={boatA} boatB={boatB} overlapped={evaluation.overlapped} />}
		</div>
	);
}

export default App;
