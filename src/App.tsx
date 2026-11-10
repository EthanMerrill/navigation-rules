import {useEffect, useReducer, useRef} from "react";
import "./App.css";
import "./styles/styles.css";
import RulesSidebar from "./components/RulesSidebar";
import AppHeader from "./components/AppHeader";
import MoveableBoat from "./components/MoveableBoat";
import MarkMarker from "./components/MarkMarker";
import ObstructionMarker from "./components/ObstructionMarker";
import TransomLineOverlay from "./components/TransomLineOverlay";
import {createDefaultWorld, worldReducer} from "./state/worldReducer";
import {useRulesEngine} from "./hooks/useRulesEngine";
import {scenarioHash, useScenarioRoute} from "./hooks/useScenarioRoute";
import {cloneWorld, findScenario} from "./scenarios";
import type {WorldState} from "./model/world";

/** A fresh copy of the world for a scenario id; the default scene when the id is null or unknown. */
function worldForRoute(id: string | null): WorldState {
	const scenario = findScenario(id);
	return scenario ? cloneWorld(scenario.world) : createDefaultWorld();
}

function App() {
	const isFirstRoute = useRef(true);
	const scenarioId = useScenarioRoute();
	const [world, dispatch] = useReducer(worldReducer, scenarioId, worldForRoute);

	// Load the routed scenario whenever the route changes. The initial world
	// already matches the first route, so skip the first run.
	useEffect(() => {
		if (!isFirstRoute.current) dispatch({type: "loadScenario", world: worldForRoute(scenarioId)});
		isFirstRoute.current = false;
	}, [scenarioId]);

	const evaluation = useRulesEngine(world);
	const focusPair = evaluation.focusPair ? evaluation.pairs[evaluation.focusPair] : null;
	const focusA = focusPair && world.boats.find((boat) => boat.id === focusPair.a);
	const focusB = focusPair && world.boats.find((boat) => boat.id === focusPair.b);

	return (
		<div className="App">
			<div className="patterns pt1"></div>
			<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');</style>
			<AppHeader
				wind={world.wind}
				onWindChange={(direction) => dispatch({type: "setWind", direction})}
				scenarioId={findScenario(scenarioId)?.id ?? ""}
				onScenarioChange={(id) => {
					window.location.hash = id ? scenarioHash(id) : "";
				}}
				onReset={() => dispatch({type: "loadScenario", world: worldForRoute(scenarioId)})}
			/>
			<RulesSidebar evaluation={evaluation} />
			{world.obstructions.map((obstruction) => (
				<ObstructionMarker key={obstruction.id} obstruction={obstruction} dispatch={dispatch} />
			))}
			{world.marks.map((mark) => (
				<MarkMarker key={mark.id} mark={mark} dispatch={dispatch} />
			))}
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
