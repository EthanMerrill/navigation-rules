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

	const evaluation = useRulesEngine(world);
	const focusPair = evaluation.focusPair ? evaluation.pairs[evaluation.focusPair] : null;
	const focusA = focusPair && world.boats.find((boat) => boat.id === focusPair.a);
	const focusB = focusPair && world.boats.find((boat) => boat.id === focusPair.b);

	return (
		<div className="App">
			<div className="patterns pt1"></div>
			<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');</style>
			<AppHeader wind={world.wind} onWindChange={(direction) => dispatch({type: "setWind", direction})} />
			<RulesSidebar evaluation={evaluation} />
			{world.boats.map((boat) => (
				<div className="draggable" key={boat.id}>
					<MoveableBoat boatState={boat} dispatch={dispatch} text={boat.id} boatView={evaluation.boats[boat.id]} />
				</div>
			))}
			{focusPair && focusA && focusB && <TransomLineOverlay boatA={focusA} boatB={focusB} overlapped={focusPair.overlapped} />}
		</div>
	);
}

export default App;
