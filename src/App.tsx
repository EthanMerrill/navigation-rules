import React, {useEffect, useState} from "react";
import "./App.css";

import MoveableBoat from "./components/MoveableBoat";
export interface  IBoatRights{
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

  function styleParse(transformstyle: string) {
    let matchArr = transformstyle.match(/([\w]+)\(([^\)]+)\)/g);
    if (matchArr) {
      return matchArr
        .map(function (it: string) {
          return it.replace(/\)$/, "").split(/\(/);
        })
        .reduce(function (m: any, it: any) {
          return (m[it[0]] = it[1]), m;
        }, {});
    }
  }

  // Port Starboard Ruleset
  function portStarboardRuleset(boat1:string, boat2:string) {
    if(Math.floor(styleParse(style1)?.rotate?.slice(0, -3)/180) % 2 === 0){
      boat1Rights.stbdTack = false;
    }else{
      boat1Rights.stbdTack = true;
    }
    if(Math.floor(styleParse(style2)?.rotate?.slice(0, -3)/180) % 2 === 0){
      boat2Rights.stbdTack = false;
    }else{
      boat2Rights.stbdTack = true;
    }
    console.log("boat1: ", boat1Rights, boat2Rights)
  }



  useEffect(() => {
    portStarboardRuleset(style1, style2);
  }, [style1, style2]);

  return (
    <div className="App">
      <div className="draggable">
        
        <MoveableBoat setStyleState={setStyle1} styleState={style1} moveRef={moveRef1} backgroundColor={"blue"} text='boat1' boatRights = {boat1Rights}/>
      </div>
      <div className="draggable">
        <MoveableBoat setStyleState={setStyle2} styleState={style2} moveRef={moveRef2} backgroundColor={"red"} text='boat2' boatRights={boat2Rights}/>
      </div>
    </div>
  );
}

export default App;
