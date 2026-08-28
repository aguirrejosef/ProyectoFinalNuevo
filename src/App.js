import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// Bloquea el acceso a una ruta si no hay sesión, o si el rol no está permitido.
function RutaPrivada({ rolesPermitidos, children }) {
  const token = localStorage.getItem('token');
  const rol = Number(localStorage.getItem('rol'));

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (rolesPermitidos && !rolesPermitidos.includes(rol)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/admin"
            element={<RutaPrivada rolesPermitidos={[1]}><PanelAdmin /></RutaPrivada>}
          />
          <Route path="/club" element={<Home />} />
          <Route path="/cliente" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/recuperar-password" element={<RecPassword />} />
          <Route path="/registro-club" element={<RegistroClub />} />
          <Route path="/registro-usuario" element={<RegistroUsuario />} />
          <Route path="/canchas" element={<Canchas />} />
          <Route path="/canchas/:id" element={<Club />} />
          <Route path="/historia" element={<Historia />} />
          <Route
            path="/usuario"
            element={<RutaPrivada rolesPermitidos={[1, 2]}><Usuario /></RutaPrivada>}
          />
          <Route
            path="/mi-perfil"
            element={<RutaPrivada><Perfil /></RutaPrivada>}
          />
          <Route
            path="/mis-turnos"
            element={<RutaPrivada rolesPermitidos={[3]}><MisTurnos /></RutaPrivada>}
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/novedades" element={<Novedades />} />
          <Route
            path="/mis-canchas"
            element={<RutaPrivada rolesPermitidos={[2]}><MisCanchas /></RutaPrivada>}
          />
          <Route
            path="/mis-canchas/:idCancha/turnos"
            element={<RutaPrivada rolesPermitidos={[2]}><TurnosCancha /></RutaPrivada>}
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
