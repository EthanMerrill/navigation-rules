import {useEffect, useMemo, useReducer, useRef, useState} from "react";
import "./App.css";
import "./styles/styles.css";
import RulesSidebar from "./components/RulesSidebar";
import AppHeader from "./components/AppHeader";
import HailControls from "./components/HailControls";
import MoveableBoat from "./components/MoveableBoat";
import MarkMarker from "./components/MarkMarker";
import ObstructionMarker from "./components/ObstructionMarker";
import TransomLineOverlay from "./components/TransomLineOverlay";
import BoatBadgeLayer from "./components/BoatBadgeLayer";
import PlayArea from "./components/PlayArea";
import {createDefaultWorld, worldReducer} from "./state/worldReducer";
import {useRulesEngine} from "./hooks/useRulesEngine";
import {scenarioHash, useScenarioRoute} from "./hooks/useScenarioRoute";
import {cloneWorld, findScenario} from "./scenarios";
import type {WorldState} from "./model/world";
import {boatBadge} from "./ui/boatBadge";

/** A fresh copy of the world for a scenario id; the default scene when the id is null or unknown. */
function worldForRoute(id: string | null): WorldState {
	const scenario = findScenario(id);
	return scenario ? cloneWorld(scenario.world) : createDefaultWorld();
}

function App() {
	const isFirstRoute = useRef(true);
	const scenarioId = useScenarioRoute();
	const [world, dispatch] = useReducer(worldReducer, scenarioId, worldForRoute);
	// Bumped whenever a scenario is loaded, so the rules engine starts from empty memory.
	const [epoch, setEpoch] = useState(0);
	// True while the pointer is held on the water: the sidebar waits for the drag to end before re-sorting.
	const [pointerHeld, setPointerHeld] = useState(false);

	const loadRoute = () => {
		dispatch({type: "loadScenario", world: worldForRoute(scenarioId)});
		setEpoch((n) => n + 1);
	};

	// Load the routed scenario whenever the route changes. The initial world
	// already matches the first route, so skip the first run.
	useEffect(() => {
		if (!isFirstRoute.current) loadRoute();
		isFirstRoute.current = false;
	}, [scenarioId]);

	const evaluation = useRulesEngine(world, epoch);
	const badges = useMemo(() => Object.fromEntries(world.boats.map((boat) => [boat.id, boatBadge(boat.id, evaluation.obligations)])), [world.boats, evaluation]);
	const focusPair = evaluation.focusPair ? evaluation.pairs[evaluation.focusPair] : null;
	const focusA = focusPair && world.boats.find((boat) => boat.id === focusPair.a);
	const focusB = focusPair && world.boats.find((boat) => boat.id === focusPair.b);

	return (
		<div className="App">
			<RulesSidebar evaluation={evaluation} interacting={pointerHeld} resetKey={epoch} />
			<div className="app-main">
				<AppHeader
					scenarioId={findScenario(scenarioId)?.id ?? ""}
					onScenarioChange={(id) => {
						window.location.hash = id ? scenarioHash(id) : "";
					}}
					onReset={loadRoute}>
					<HailControls world={world} dispatch={dispatch} />
				</AppHeader>
				<PlayArea world={world} fitKey={epoch} onWindChange={(direction) => dispatch({type: "setWind", direction})} onPointerHeldChange={setPointerHeld}>
					{world.obstructions.map((obstruction) => (
						<ObstructionMarker key={obstruction.id} obstruction={obstruction} dispatch={dispatch} />
					))}
					{world.marks.map((mark) => (
						<MarkMarker key={mark.id} mark={mark} dispatch={dispatch} />
					))}
					{world.boats.map((boat) => (
						<div className="draggable" key={boat.id}>
							<MoveableBoat boatState={boat} dispatch={dispatch} text={boat.id} boatView={evaluation.boats[boat.id]} badge={badges[boat.id]} />
						</div>
					))}
					<BoatBadgeLayer world={world} badges={badges} />
					{focusPair && focusA && focusB && <TransomLineOverlay boatA={focusA} boatB={focusB} overlapped={focusPair.overlapped} />}
				</PlayArea>
			</div>
		</div>
	);
}

export default App;
