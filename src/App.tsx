import React from 'react';
import './App.css';
import Moveable from 'react-moveable';
import PrototypeBoat from './assets/PrototypeBoat.svg';

function App() {
  // const targetRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="App">

      <div className='canvas' style={{height:500, width:500}}>
      </div>
      <div className="draggable">
        <ThingToMove/>
      </div>
      <div className="draggable">
        <ThingToMove/>
      </div>
    </div>
  );
};

const ThingToMove = () => {
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
      <MovableComponent moveRef={moveRef} setStyle={setStyle} />
    </div>
  );
};

interface iMovableComponentProps {
  moveRef: React.RefObject<HTMLDivElement>;
  setStyle: React.Dispatch<React.SetStateAction<string>>;
}

const MovableComponent = ({ moveRef, setStyle }:iMovableComponentProps) => {
  const [renderMovable, settRenderMovable] = React.useState(false);

  React.useEffect(() => {
    settRenderMovable(true);
  }, []);

  const handleDrag = (e: { transform: React.SetStateAction<string>; }) => {
    setStyle(e.transform);
  };

  const handleRotate = (e: { transform: React.SetStateAction<string>; }) => {
    setStyle(e.transform);
  };

  if (!renderMovable) return null;

  return (
    <Moveable
      target={moveRef.current}
      draggable={true}
      throttleDrag={0}
      onDrag={handleDrag}
      rotatable={true}
      onRotate={handleRotate}
    />
  );
};

export default App;
