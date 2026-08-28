import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './components/pages/Home';
import Login from './components/pages/Login';
import RecPassword from './components/pages/RecPassword';
import RegistroClub from './components/pages/RegistroClub';
import RegistroUsuario from './components/pages/RegistroUsuario';
import Canchas from './components/pages/Canchas';
import Club from './components/pages/Club';
import PanelAdmin from './components/pages/PanelAdmin';
import Historia from './components/Historia/Historia';
import Usuario from './components/pages/Usuarios';
import Perfil from './components/pages/Perfil';
import MisTurnos from './components/pages/MisTurnos';
import ResetPassword from './components/pages/ResetPassword';
import Planes from './components/pages/Planes';
import Novedades from './components/pages/Novedades';
import MisCanchas from './components/pages/MisCanchas';
import TurnosCancha from './components/pages/TurnosCancha';
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<Home />} />
          <Route path="/club" element={<Home />} />
          <Route path="/cliente" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-password" element={<RecPassword />} />
          <Route path="/registro-club" element={<RegistroClub />} />
          <Route path="/registro-usuario" element={<RegistroUsuario />} />
          <Route path="/canchas" element={<Canchas />} />
          <Route path="/canchas/:id" element={<Club />} />
          <Route path="/historia" element={<Historia />} />
          <Route path="/usuario" element={<Usuario />} />
          <Route path="/mi-perfil" element={<Perfil />} />
          <Route path="/mis-turnos" element={<MisTurnos />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/novedades" element={<Novedades />} />
          <Route path="/mis-canchas" element={<MisCanchas />} />
          <Route path="/mis-canchas/:idCancha/turnos" element={<TurnosCancha />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
