import React from 'react';
import './App.css';

import MoveableBoat from './components/MoveableBoat'

function App() {
  return (
    <div className="App">
      <div className="draggable">
        <MoveableBoat/>
      </div>
      <div className="draggable">
        <MoveableBoat/>
      </div>
    </div>
  );
};

export default App;