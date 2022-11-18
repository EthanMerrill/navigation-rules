
import React,{useEffect} from "react";
import MoveableComponent from './MoveableComponent';
import PrototypeBoat from '../assets/PrototypeBoat.svg';

export interface ImoveableBoatProps {
    styleState: string;
    setStyleState: React.Dispatch<React.SetStateAction<string>>;
    backgroundColor: string;
}

const MoveableBoat = (props:ImoveableBoatProps) => {

    const {styleState, setStyleState, backgroundColor} = props;

    const moveRef = React.useRef(null);

    // useEffect(() => {
    //     console.log("style", style, moveRef);
    // }, [style]);
  
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
          <img alt='boat 1 svg' src={PrototypeBoat}/>
        </div>
        <MoveableComponent moveRef={moveRef} setStyle={setStyleState} />
      </div>
    );
  };

  export default MoveableBoat