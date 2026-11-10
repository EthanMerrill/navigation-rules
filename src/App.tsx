import React, {useState} from "react";
import "./App.css";
import "./styles/styles.css";
import RulesSidebar from "./components/RulesSidebar";
import AppHeader from "./components/AppHeader";
import MoveableBoat from "./components/MoveableBoat";
import TransomLineOverlay from "./components/TransomLineOverlay";
import {BoatState, WindState} from "./rules/rulesEngine";
import {useRulesEngine} from "./hooks/useRulesEngine";

const BOAT1_INITIAL: BoatState = {id: "boat1", x: 300, y: 150, heading: 90, tacking: false};
const BOAT2_INITIAL: BoatState = {id: "boat2", x: 300, y: 350, heading: 90, tacking: false};
const WIND_INITIAL: WindState = {direction: 0};

function App() {
	const [boat1, setBoat1] = useState<BoatState>(BOAT1_INITIAL);
	const [boat2, setBoat2] = useState<BoatState>(BOAT2_INITIAL);
	const [wind, setWind] = useState<WindState>(WIND_INITIAL);

	const evaluation = useRulesEngine(boat1, boat2, wind);
	const [boat1View, boat2View] = evaluation.boats;

	const moveRef1 = React.useRef<HTMLDivElement>(null);
	const moveRef2 = React.useRef<HTMLDivElement>(null);

	const toggleTacking = (boatId: string) => {
		const setter = boatId === "boat1" ? setBoat1 : setBoat2;
		setter((prev) => ({...prev, tacking: !prev.tacking}));
	};

	return (
		<div className="App">
			<div className="patterns pt1"></div>
			<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');</style>
			<AppHeader wind={wind} onWindChange={(direction) => setWind({direction})} boat1Tacking={boat1.tacking} boat2Tacking={boat2.tacking} onToggleTacking={toggleTacking} />
			<RulesSidebar evaluation={evaluation} />
			<div className="draggable">
				<MoveableBoat boatState={boat1} setBoatState={setBoat1} moveRef={moveRef1} text="boat1" boatRuleView={boat1View} />
			</div>
			<div className="draggable">
				<MoveableBoat boatState={boat2} setBoatState={setBoat2} moveRef={moveRef2} text="boat2" boatRuleView={boat2View} />
			</div>
			<TransomLineOverlay boatA={boat1} boatB={boat2} overlapped={evaluation.overlapped} />
		</div>
	);
}

export default App;
