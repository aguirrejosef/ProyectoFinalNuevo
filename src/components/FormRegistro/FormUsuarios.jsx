import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FormUsuarios.css';
import Modal from '../Modal/Modal';
import { apiFetch } from '../../api';
 
function FormUsuarios() {
  const navigate = useNavigate();
 
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [dni, setDni] = useState('');
  const [usuario, setUsuario] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
 
  const [isSubmitDisabled, setIsSubmitDisabled] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [mensaje, setMensaje] = useState('');
 
  // Validación del formulario
  useEffect(() => {
    const isFormValid =
      nombre &&
      apellido &&
      dni&&
      usuario &&
      correo &&
      telefono &&
      password &&
      confirmarPassword;
 
    setIsSubmitDisabled(!isFormValid);
  }, [nombre, apellido, dni, usuario, correo, telefono, password, confirmarPassword]);
 
  // Envío del formulario
 const [enviando, setEnviando] = useState(false);
 
const handleSubmit = async (e) => {
  e.preventDefault();
 
  if (password.length < 6) {
    setMensaje('La contraseña debe tener al menos 6 caracteres');
    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 2000);
    return;
  }
 
  if (password !== confirmarPassword) {
    setMensaje('Las contraseñas no coinciden');
    setModalVisible(true);
    setTimeout(() => setModalVisible(false), 2000);
    return;
  }
 
  setEnviando(true);
 
    const usuarioData = {
      nombre,
      apellido,
      dni,
      usuario,
      correo,
      telefono,
      password
    };
 
    try {
      const response = await apiFetch('/FormUsuarios', {
        method: 'POST',
        body: JSON.stringify(usuarioData)
      });

      const data = await response.json();

      if (response.ok) {
        setMensaje(data.message || 'Registro exitoso');

        // Guardar sesión (auto-login)
        localStorage.setItem('token', data.token);
        localStorage.setItem('id', data.id);
        localStorage.setItem('usuario', data.usuario);
        localStorage.setItem('nombre', data.nombre || '');
        localStorage.setItem('apellido', data.apellido || '');
        localStorage.setItem('dni', data.dni || '');
        localStorage.setItem('correo', data.correo || '');
        localStorage.setItem('telefono', data.telefono || '');
        localStorage.setItem('foto', data.foto || '');
        localStorage.setItem('rol', data.rol);

        // Limpiar formulario
        setNombre('');
        setApellido('');
        setUsuario('');
        setCorreo('');
        setTelefono('');
        setPassword('');
        setConfirmarPassword('');
 
        setModalVisible(true);
        setTimeout(() => {
          setModalVisible(false);
          navigate('/cliente');
        }, 2000);
        return;
 
      } else {
        setMensaje(data.message || 'Error en el registro');
      }
    } catch (error) {
    console.error('Error:', error);
    setMensaje('No se pudo conectar con el servidor');
  } finally {
    setEnviando(false); // 👈 se re-habilita al terminar (éxito o error)
  }
 
  setModalVisible(true);
  setTimeout(() => setModalVisible(false), 2000);
};
 
  const handleVolverLogin = () => navigate('/login');
 
  return (
    <div className="form-container">
      <h2>Completá tus datos para inscribirte</h2>
 
      <form onSubmit={handleSubmit}>
 
        <div className="form-group">
          <label>Nombre:</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Apellido:</label>
          <input
            type="text"
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            required
          />
        </div>
 
         <div className="form-group">
          <label>Dni:</label>
          <input
            type="dni"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
            required
          />
        </div>
 
        <div className="form-group">
          <label>Usuario:</label>
          <input
            type="text"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
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
          <label>Teléfono:</label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            required
          />
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
 
        <div className="form-group">
          <label>Confirmar contraseña:</label>
          <input
            type="password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
 
        <button type="submit" disabled={isSubmitDisabled || enviando}>
            {enviando ? 'Enviando...' : 'Registrarme'}
        </button>
 
      </form>
 
      <p className="FormUsuarios-negocio" onClick={handleVolverLogin}>
        ¿Ya tenés cuenta? Iniciá sesión
      </p>
 
      {modalVisible && <Modal tituloMsj="Registro" cuerpoMsj={mensaje} />}
    </div>
  );
}
 
export default FormUsuarios;