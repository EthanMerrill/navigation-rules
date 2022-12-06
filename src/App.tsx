import React, {useEffect, useState} from "react";
import "./App.css";
import './styles/styles.css';
import { styleParse } from "./utilities/HelperFunctions";
import RulesSidebar from "./components/RulesSidebar";
import AppHeader from "./components/AppHeader";
import MoveableBoat from "./components/MoveableBoat";
export interface IBoatRights {
  stbdTack: boolean;
  leeward: boolean;
  standonBoat: boolean;
}

function App() {
  const [style1, setStyle1] = React.useState("");
  const [style2, setStyle2] = React.useState("");
  const [boat1Rights, setBoat1Rights] = useState<IBoatRights>({
    stbdTack: true,
    leeward: true,
    standonBoat: false,
  });

  const [boat2Rights, setBoat2Rights] = useState<IBoatRights>({
    stbdTack: false,
    leeward: false,
    standonBoat: false,
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
      boat1Rights.leeward = true;
      boat2Rights.leeward = false;
    } else {
      boat1Rights.leeward = false;
      boat2Rights.leeward = true;
    }
  }
}

function standOnBoatCalc() {
  //opposite tacks
  if (boat1Rights.stbdTack !== boat2Rights.stbdTack) {
    if(boat1Rights.stbdTack === true) {
      boat1Rights.standonBoat = true;
      boat2Rights.standonBoat = false;
    } else {
      boat1Rights.standonBoat = false;
      boat2Rights.standonBoat = true;
    }}
    if (boat1Rights.stbdTack === boat2Rights.stbdTack) {
      if(boat1Rights.leeward === true) {
        boat1Rights.standonBoat = true;
        boat2Rights.standonBoat = false;
      } else {
        boat1Rights.standonBoat = false;
        boat2Rights.standonBoat = true;
      }
  }
}


  useEffect(() => {
    portStarboardRuleset(style1, style2);
    windwardLeewardRuleset(style1, style2);
    standOnBoatCalc();
    // console.log(boat1Rights, boat2Rights);
  }, [style1, style2]);

  return (
    <div className="App">
      <div className='patterns pt1'></div>
      <style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
</style>
      <AppHeader/>
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
