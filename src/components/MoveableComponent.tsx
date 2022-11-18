import React from 'react';
import Moveable from 'react-moveable';


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

  export default MovableComponent;