import { createRoot } from 'react-dom/client';
import '../estilos/comum.css';
import '../estilos/jogador.css';
import { App } from './App.tsx';

createRoot(document.getElementById('app')!).render(<App />);
