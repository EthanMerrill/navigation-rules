import {useEffect, useMemo, useReducer, useRef, useState} from "react";
import "./App.css";
import "./styles/styles.css";
import RulesSidebar from "./components/RulesSidebar";
import AppHeader from "./components/AppHeader";
import HailControls from "./components/HailControls";
import MoveableBoat from "./components/MoveableBoat";
import MarkMarker, {PairLines} from "./components/MarkMarker";
import ScenePalette, {newBoatHeading, type PaletteItemKind} from "./components/ScenePalette";
import ObstructionMarker from "./components/ObstructionMarker";
import TransomLineOverlay from "./components/TransomLineOverlay";
import BoatBadgeLayer from "./components/BoatBadgeLayer";
import PlayArea, {type PlayAreaApi} from "./components/PlayArea";
import {createDefaultWorld, worldReducer, type WorldAction} from "./state/worldReducer";
import {useRulesEngine} from "./hooks/useRulesEngine";
import {scenarioHash, useScenarioRoute} from "./hooks/useScenarioRoute";
import {cloneWorld, findScenario} from "./scenarios";
import type {WorldState} from "./model/world";
import type {Vec2} from "./view/scale";
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
	const playArea = useRef<PlayAreaApi>(null);
	const trayRef = useRef<HTMLDivElement>(null);
	// Set while a boat or mark is dragged: the tray is then a drop target that removes it.
	const [removal, setRemoval] = useState<{overTray: boolean} | null>(null);

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

	const overTray = (x: number, y: number) => {
		const r = trayRef.current?.getBoundingClientRect();
		return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
	};
	/** Tracks a drag of something on the water; dropped on the tray, `remove` is dispatched. */
	const dragPointer = (remove: WorldAction) => (x: number, y: number, ended: boolean) => {
		const over = overTray(x, y);
		if (!ended) return setRemoval((r) => (r?.overTray === over ? r : {overTray: over}));
		setRemoval(null);
		if (over) dispatch(remove);
	};
	const addItem = (kind: PaletteItemKind, at: Vec2) =>
		dispatch(kind === "boat" ? {type: "addBoat", boat: {x: at.x, y: at.y, heading: newBoatHeading(world.wind.direction)}} : {type: "addMark", kind, x: at.x, y: at.y});
	const routeId = findScenario(scenarioId)?.id ?? "";

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
					scenarioId={routeId}
					custom={world.course.inferNextMark === true}
					onScenarioChange={(id) => {
						// Picking the scenario the route already names (after editing it) reloads it.
						if (id === routeId) loadRoute();
						else window.location.hash = id ? scenarioHash(id) : "";
					}}
					onReset={loadRoute}>
					<ScenePalette windDirection={world.wind.direction} playArea={playArea} onAdd={addItem} removal={removal} trayRef={trayRef} />
					<HailControls world={world} dispatch={dispatch} />
				</AppHeader>
				<PlayArea world={world} fitKey={epoch} onWindChange={(direction) => dispatch({type: "setWind", direction})} onPointerHeldChange={setPointerHeld} apiRef={playArea}>
					{world.obstructions.map((obstruction) => (
						<ObstructionMarker key={obstruction.id} obstruction={obstruction} dispatch={dispatch} />
					))}
					<PairLines marks={world.marks} />
					{world.marks.map((mark) => (
						<MarkMarker key={mark.id} mark={mark} dispatch={dispatch} windDirection={world.wind.direction} onDragPointer={dragPointer({type: "removeMark", id: mark.id})} />
					))}
					{world.boats.map((boat) => (
						<div className="draggable" key={boat.id}>
							<MoveableBoat boatState={boat} dispatch={dispatch} text={boat.id} boatView={evaluation.boats[boat.id]} badge={badges[boat.id]} onDragPointer={dragPointer({type: "removeBoat", id: boat.id})} />
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
