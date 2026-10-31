import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './FormRegistro.css';
import Modal from '../Modal/Modal';
import { apiFetch } from '../../api';
 
const PLANES = [
  { id: 'basico', label: 'Básico', precio: 5000 },
  { id: 'estandar', label: 'Estándar', precio: 8000 },
  { id: 'premium', label: 'Premium', precio: 12000 }
];

// Debe coincidir con LIMITE_CANCHAS_POR_PLAN en src/backend/db.js. Premium no
// tiene tope (Infinity), ahí se deja elegir libremente.
const LIMITE_CANCHAS_POR_PLAN = { basico: 4, estandar: 6, premium: Infinity };

const formatearPrecioPlan = (precio) => `$${precio.toLocaleString('es-AR')}/mes`;
 
function FormRegistro() {
  const location = useLocation();
  const navigate = useNavigate();

  const [nombreClub, setNombreClub] = useState('');
  const [telefono, setTelefono] = useState('');
  const [provincia, setProvincia] = useState('');
  const [localidad, setLocalidad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [correo, setCorreo] = useState('');
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState(location.state?.planSeleccionado || 'basico');
  const [canchas, setCanchas] = useState(() => {
    const planInicial = location.state?.planSeleccionado || 'basico';
    return planInicial === 'premium' ? '' : String(LIMITE_CANCHAS_POR_PLAN[planInicial]);
  });

  const esPlanLibre = plan === 'premium';

  const handleCambiarPlan = (nuevoPlan) => {
    setPlan(nuevoPlan);
    setCanchas(nuevoPlan === 'premium' ? '' : String(LIMITE_CANCHAS_POR_PLAN[nuevoPlan]));
  };

  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
 
  // Validación del formulario
  useEffect(() => {
    const isFormValid =
      nombreClub &&
      telefono &&
      provincia&&
      localidad &&
      direccion &&
      correo &&
      canchas &&
      usuario &&
      password;
 
    setIsSubmitDisabled(!isFormValid);
  }, [nombreClub, telefono,provincia, localidad, direccion, correo, canchas, usuario, password]);
 
  // Envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
 
    if (password.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres');
      setModalVisible(true);
      setTimeout(() => setModalVisible(false), 2000);
      return;
    }
 
    if (Number(canchas) <= 0) {
    setMensaje('La cantidad de canchas debe ser mayor a 0');
    setModalVisible(true);
    return;
  }
    const clubData = {
      nombreClub,
      nroTitular: telefono, // backend espera nroTitular como telefono
      provincia,
      localidad,
      direccion,
      correo,
      usuario,
      password,
      canchas: Number(canchas),
      plan
    };
 
    setEnviando(true);

    try {
      const response = await apiFetch('/usuarios/registro-club', {
        method: 'POST',
        body: JSON.stringify(clubData)
      });

      const data = await response.json();

      if (response.ok && data.init_point) {
        // Abrimos Mercado Pago en una pestaña nueva y nos quedamos en la
        // pantalla de confirmación (que consulta el estado del registro
        // sola), igual que al pagar la seña de una reserva.
        window.open(data.init_point, '_blank');
        navigate(`/registro-club/confirmacion?registro=${data.id_registro}`);
        return;
      }

      setMensaje(data.message || (response.ok ? 'Registro iniciado' : 'Error en el registro'));

    } catch (error) {
      console.error('Error:', error);
      setMensaje('No se pudo conectar con el servidor');
    } finally {
      setEnviando(false);
    }

    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 2000);
  };
 
  return (
    <div className="form-container">
      <h1 className="form-titulo">Registro de Club</h1>
 
      <form onSubmit={handleSubmit}>
 
        <div className="form-group">
          <label>Nombre del club:</label>
          <input
            type="text"
            value={nombreClub}
            onChange={(e) => setNombreClub(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Teléfono del club:</label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Provincia:</label>
          <input
            type="text"
            value={provincia}
            onChange={(e) => setProvincia(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Localidad:</label>
          <input
            type="text"
            value={localidad}
            onChange={(e) => setLocalidad(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Dirección:</label>
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Correo Electrónico:</label>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Nombre de usuario:</label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Plan:</label>
          <select
            value={plan}
            onChange={(e) => handleCambiarPlan(e.target.value)}
            required
          >
            {PLANES.map((p) => (
              <option key={p.id} value={p.id}>{p.label} - {formatearPrecioPlan(p.precio)}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Cantidad de canchas:</label>
          <input
            type="number"
            value={canchas}
            onChange={(e) => setCanchas(e.target.value)}
            min={1}
            readOnly={!esPlanLibre}
            disabled={!esPlanLibre}
            required
          />
          <small>
            {esPlanLibre
              ? 'Plan Premium: ingresá la cantidad de canchas que vas a publicar.'
              : `El plan ${PLANES.find((p) => p.id === plan)?.label} incluye ${canchas} canchas.`}
          </small>
        </div>

        <div className="form-group">
          <label>Contraseña:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
 
        <button type="submit" disabled={isSubmitDisabled || enviando}>
          {enviando ? 'Generando el pago...' : 'Siguiente'}
        </button>
 
      </form>
 
      {modalVisible && <Modal mensaje={mensaje} />}
    </div>
  );
}
 
export default FormRegistro;