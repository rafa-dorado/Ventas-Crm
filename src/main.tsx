import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { NubeGate } from './nube/NubeGate';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <NubeGate>
    <App />
  </NubeGate>
);
