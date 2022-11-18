
import React, {useEffect} from "react";
import MoveableComponent from './MoveableComponent';
import PrototypeBoat from '../assets/PrototypeBoat.svg';
import { IBoatRights } from "../App";
export interface ImoveableBoatProps {
    styleState: string;
    setStyleState: React.Dispatch<React.SetStateAction<string>>;
    moveRef: React.RefObject<HTMLDivElement>;
    backgroundColor: string;
    text:string;
    boatRights: IBoatRights;
}

const MoveableBoat = (props:ImoveableBoatProps) => {

    const {styleState, setStyleState, moveRef, backgroundColor, text} = props;

    return (
      <div>
        <div
          className='boat-wrapper'
          ref={moveRef}
          style={{
            'transform': styleState,
            'background': backgroundColor
          }}
        >
          <img alt={text} src={PrototypeBoat}/>
          <p>{text}</p>
        </div>
        <MoveableComponent moveRef={moveRef} setStyle={setStyleState} />
      </div>
    );
  };

  export default MoveableBoat