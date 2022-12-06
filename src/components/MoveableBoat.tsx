import React, {useEffect} from "react";
import MoveableComponent from "./MoveableComponent";
import PrototypeBoat from "../assets/PrototypeBoat.svg";
import {IBoatRights} from "../App";
import { useSpring, animated } from 'react-spring';

export interface ImoveableBoatProps {
  styleState: string;
  setStyleState: React.Dispatch<React.SetStateAction<string>>;
  moveRef: React.RefObject<HTMLDivElement>;
  backgroundColor: string;
  text: string;
  boatRights: IBoatRights;
}

const MoveableBoat = (props: ImoveableBoatProps) => {
  const {styleState, setStyleState, moveRef, backgroundColor, text, boatRights} = props;

  const [sailPath, setSailPath] = React.useState("M10 1C-0.5 14.5 -0.5 61.5 3.5 78.5");

  const animationProps = useSpring({
    path: sailPath
  });

  const sailPaths= [
    "M10 1C-0.5 14.5 -0.5 61.5 3.5 78.5",
    "M0.999999 1C11.5 14.5 11.5 61.5 7.5 78.5" 
  ]

  function tackChange() {
    if (!boatRights.stbdTack) {
      setSailPath("M0.999999 1C11.5 14.5 11.5 61.5 7.5 78.5");
     
    } else {
      setSailPath("M10 1C-0.5 14.5 -0.5 61.5 3.5 78.5");
    }
  }

  useEffect(() => {
    tackChange();
  }, [props.boatRights.stbdTack]);

  // https://codesandbox.io/s/react-spring-svg-4-4-kv2qm?file=/src/App.js
  return (
    <div>
      <div
        className="boat-wrapper"
        ref={moveRef}
        style={{
          transform: styleState,
        }}>
        <img alt={text} src={PrototypeBoat} className={boatRights.standonBoat?'standon-boat':'giveway-boat'} />
        {boatRights.leeward ? <div className="leeward-tag"><p className="text-tag"><u>Leeward</u></p></div> : <div className="windward-tag"><p className="text-tag">Windward</p></div>}
        {boatRights.stbdTack ? <div className="starboard-tag"><p className='text-tag'>Starboard</p></div> : <div className='port-tag'><p className="text-tag">Port</p></div>}
        <svg className={"sail-path"} width="11" height="79" viewBox="0 0 11 79" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path  d={sailPath} stroke="black" />
        </svg>
      </div>
      <MoveableComponent moveRef={moveRef} setStyle={setStyleState} />
    </div>
  );
};

export default MoveableBoat;
