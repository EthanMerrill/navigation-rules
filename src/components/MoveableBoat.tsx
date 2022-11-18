
import React from "react";
import MoveableComponent from './MoveableComponent';
import PrototypeBoat from '../assets/PrototypeBoat.svg';

const MoveableBoat = () => {
    const moveRef = React.useRef(null);
    const [style, setStyle] = React.useState("");
  
    return (
      <div>
        <div
          className='boat-wrapper'
          ref={moveRef}
          style={{
            transform: style
          }}
        >
          <img alt='boat 1 svg' src={PrototypeBoat}/>
        </div>
        <MoveableComponent moveRef={moveRef} setStyle={setStyle} />
      </div>
    );
  };

  export default MoveableBoat