import React, {useEffect, useState} from "react";
import "./App.css";
import './styles/styles.css';
import { styleParse } from "./utilities/HelperFunctions";
import RulesSidebar from "./components/RulesSidebar";

import MoveableBoat from "./components/MoveableBoat";
export interface IBoatRights {
  stbdTack: boolean;
  leward: boolean;
}

function App() {
  const [style1, setStyle1] = React.useState("");
  const [style2, setStyle2] = React.useState("");
  const [boat1Rights, setBoat1Rights] = useState<IBoatRights>({
    stbdTack: true,
    leward: true,
  });

  const [boat2Rights, setBoat2Rights] = useState<IBoatRights>({
    stbdTack: true,
    leward: true,
  });

  const moveRef1 = React.useRef(null);
  const moveRef2 = React.useRef(null); 

  // Port Starboard Ruleset
  function portStarboardRuleset(boat1: string, boat2: string) {
  if (Math.floor(styleParse(style1)?.rotate?.slice(0, -3) / 180) % 2 === 0) {
    boat1Rights.stbdTack = false;
  } else {
    boat1Rights.stbdTack = true;
  }
  if (Math.floor(styleParse(style2)?.rotate?.slice(0, -3) / 180) % 2 === 0) {
    boat2Rights.stbdTack = false;
  } else {
    boat2Rights.stbdTack = true;
  }
}

// windward leeward ruleset
 function windwardLeewardRuleset(boat1: string, boat2: string) {
  // boats are on the same tack
  if (boat1Rights.stbdTack === boat2Rights.stbdTack) {
    //check which boat is higher (further upwind on the course)
    // get the y values of each boat in a safe way
    if (styleParse(style1)?.translate?.match(/\d+/g)?.[1] > styleParse(style2)?.translate?.match(/\d+/g)?.[1]) {
      boat1Rights.leward = true;
      boat2Rights.leward = false;
    } else {
      boat1Rights.leward = false;
      boat2Rights.leward = true;
    }
  }
}

  useEffect(() => {
    portStarboardRuleset(style1, style2);
    windwardLeewardRuleset(style1, style2);
    // console.log(boat1Rights, boat2Rights);
  }, [style1, style2]);

  return (
    <div className="App">
      <div className='patterns pt1'></div>
      <style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
</style>
      <RulesSidebar/>
      <div className="draggable">
        <MoveableBoat setStyleState={setStyle1} styleState={style1} moveRef={moveRef1} backgroundColor={"blue"} text="boat1" boatRights={boat1Rights} />
      </div>
      <div className="draggable">
        <MoveableBoat setStyleState={setStyle2} styleState={style2} moveRef={moveRef2} backgroundColor={"red"} text="boat2" boatRights={boat2Rights} />
      </div>
      
    </div>
  );
}

export default App;
