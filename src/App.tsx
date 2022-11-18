import React from 'react';
import './App.css';

import MoveableBoat from './components/MoveableBoat'

function App() {
  const [style1, setStyle1] = React.useState("");
  const [style2, setStyle2] = React.useState("");


  return (
    <div className="App">
      <div className="draggable">
        <MoveableBoat setStyleState = {setStyle1} styleState={style1} backgroundColor={'blue'} />
      </div>
      <div className="draggable">
        <MoveableBoat setStyleState = {setStyle2} styleState={style2} backgroundColor={'red'}/>
      </div>
    </div>
  );
};

export default App;