import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/app.css';
import { boot } from './lib/boot.js';
import Login from './pages/Login.jsx';
import Game from './pages/Game.jsx';
import Community from './pages/Community.jsx';

const PAGES = { login: Login, game: Game, community: Community };
const Page = PAGES[boot.page] ?? Login;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
