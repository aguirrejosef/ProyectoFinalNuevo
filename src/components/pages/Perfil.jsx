import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import './Perfil.css';
import { apiFetch } from '../../api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUser,
    faIdCard,
    faEnvelope,
    faPhone,
    faShieldHalved,
    faLocationDot,
    faClock,
    faStar,
    faChevronUp,
    faChevronDown,
    faPenToSquare,
    faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';
import { iconoServicio } from '../../utils/iconoServicio';

// Fila de solo-lectura (icono + etiqueta + valor) o de edición (icono + etiqueta + input)
function CampoPerfil({ icon, label, name, value, editando, onChange, type = 'text' }) {
    return (
        <div className="fila-campo-perfil">
            <div className="fila-campo-icono-label">
                <span className="icono-campo-perfil"><FontAwesomeIcon icon={icon} /></span>
                <span className="label-campo-perfil">{label}</span>
            </div>
            {editando ? (
                <input
                    type={type}
                    name={name}
                    value={value}
                    onChange={onChange}
                    className="input-campo-perfil"
                />
            ) : (
                <span className="valor-campo-perfil">{value || '-'}</span>
            )}
        </div>
    );
}

function Perfil() {
    const navigate = useNavigate();
    const location = useLocation();

    const [avisoPerfilIncompleto, setAvisoPerfilIncompleto] = useState(
        location.state?.avisoPerfilIncompleto || ''
    );

    const [rol, setRol] = useState(null);
    const [usuarioId, setUsuarioId] = useState(null);
    const [foto, setFoto] = useState('');
    const [subiendoFotoPerfil, setSubiendoFotoPerfil] = useState(false);
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [cargandoClub, setCargandoClub] = useState(false);

    const [form, setForm] = useState({
        nombre: '',
        apellido: '',
        dni: '',
        correo: '',
        telefono: '',
        usuario: ''
    });

    // Datos propios del club (rol === 2)
    const [clubId, setClubId] = useState(null);
    const [formClub, setFormClub] = useState({
        nombre: '',
        direccion: '',
        localidad: '',
        provincia: '',
        telefono: '',
        horarios_atencion: '',
        hora_inicio_nocturno: ''
    });
    const [editandoClub, setEditandoClub] = useState(false);
    const [guardandoClub, setGuardandoClub] = useState(false);
    const [mensajeClub, setMensajeClub] = useState('');

    // ------------------ Seguridad: cambiar contraseña ------------------
    const [abiertoSeguridad, setAbiertoSeguridad] = useState(false);
    const [editandoPassword, setEditandoPassword] = useState(false);
    const [guardandoPassword, setGuardandoPassword] = useState(false);
    const [tieneContrasena, setTieneContrasena] = useState(true);
    const [mensajePassword, setMensajePassword] = useState('');
    const [formPassword, setFormPassword] = useState({
        passwordActual: '',
        passwordNueva: '',
        passwordConfirmar: ''
    });

    // ------------------ Carrusel de fotos del club ------------------
    const [fotos, setFotos] = useState([]);
    const [fotoIndex, setFotoIndex] = useState(0);
    const [subiendoFotoClub, setSubiendoFotoClub] = useState(false);

    // ------------------ Servicios adicionales del club ------------------
    const [servicios, setServicios] = useState([]);
    const [nuevoServicio, setNuevoServicio] = useState('');
    const [agregandoServicio, setAgregandoServicio] = useState(false);

    // ------------------ Días y horario de atención (de acá salen los rangos que el cliente puede reservar) ------------------
    const NOMBRES_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const diaVacio = () => ({ abierto: false, hora_apertura: '09:00', hora_cierre: '22:00' });
    const [diasAtencion, setDiasAtencion] = useState(
        NOMBRES_DIAS.map(() => diaVacio())
    );
    const [guardandoDia, setGuardandoDia] = useState(null); // numero_dia que se está guardando, o null
    const [errorDias, setErrorDias] = useState('');

    // ------------------ Sección "Donde estamos" (paneles colapsables) ------------------
    const [abiertoUbicacion, setAbiertoUbicacion] = useState(true);
    const [abiertoHorarios, setAbiertoHorarios] = useState(true);
    const [abiertoDiasAtencion, setAbiertoDiasAtencion] = useState(true);
    const [abiertoServicios, setAbiertoServicios] = useState(true);

    useEffect(() => {
        const storedRol = localStorage.getItem('rol');
        if (!storedRol) {
            navigate('/login');
            return;
        }

        const idUsuario = localStorage.getItem('id');

        setRol(storedRol);
        setUsuarioId(idUsuario);
        setFoto(localStorage.getItem('foto') || '');

        setForm({
            nombre: localStorage.getItem('nombre') || '',
            apellido: localStorage.getItem('apellido') || '',
            dni: localStorage.getItem('dni') || '',
            correo: localStorage.getItem('correo') || '',
            telefono: localStorage.getItem('telefono') || '',
            usuario: localStorage.getItem('usuario') || ''
        });

        cargarCuenta();

        // Si es club, traemos los datos del club desde el backend
        if (Number(storedRol) === 2) {
            cargarClub();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const cargarCuenta = async () => {
        try {
            const res = await apiFetch('/usuarios/mi-cuenta');
            const data = await res.json();

            if (res.ok) {
                setTieneContrasena(!!data.tieneContrasena);
                if (data.usuario) {
                    setForm((prev) => ({ ...prev, usuario: data.usuario }));
                    localStorage.setItem('usuario', data.usuario);
                }
            }
        } catch (err) {
            console.error('Error al cargar datos de la cuenta:', err);
        }
    };

    const cargarClub = async () => {
        setCargandoClub(true);
        try {
            const res = await apiFetch('/club/mi-club');
            const data = await res.json();

            if (res.ok) {
                setClubId(data.id_club);
                setFormClub({
                    nombre: data.nombre || '',
                    direccion: data.direccion || '',
                    localidad: data.localidad || '',
                    provincia: data.provincia || '',
                    telefono: data.telefono || '',
                    horarios_atencion: data.horarios_atencion || '',
                    hora_inicio_nocturno: data.hora_inicio_nocturno ? data.hora_inicio_nocturno.slice(0, 5) : '19:00'
                });

                cargarFotos(data.id_club);
                cargarServicios(data.id_club);
                cargarDiasAtencion(data.id_club);
            } else {
                setMensaje(data.message || 'No se pudo cargar el club');
            }
        } catch (err) {
            console.error('Error al cargar club:', err);
            setMensaje('Error al conectar con el servidor');
        } finally {
            setCargandoClub(false);
        }
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    // ------------------ Foto de perfil (club o cliente) ------------------
    const handleSubirFotoPerfil = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        setSubiendoFotoPerfil(true);
        try {
            const formData = new FormData();
            formData.append('foto', archivo);

            const res = await apiFetch(`/usuarios/${usuarioId}/foto`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || 'No se pudo subir la foto');
                return;
            }

            setFoto(data.foto);
            localStorage.setItem('foto', data.foto);

        } catch (err) {
            console.error('Error al subir la foto de perfil:', err);
            alert('Error al conectar con el servidor');
        } finally {
            setSubiendoFotoPerfil(false);
        }
    };

    const handleChangeClub = (e) => {
        setFormClub({ ...formClub, [e.target.name]: e.target.value });
    };

    const handleGuardar = async () => {
        setGuardando(true);
        setMensaje('');

        try {
            const res = await apiFetch(`/usuarios/${usuarioId}`, {
                method: 'PUT',
                body: JSON.stringify(form)
            });

            const data = await res.json();

            if (!res.ok) {
                setMensaje(`${data.message || 'Ocurrió un error al guardar los cambios'} ❌`);
                return;
            }

            // Sincronizamos localStorage con los nuevos datos
            localStorage.setItem('nombre', form.nombre);
            localStorage.setItem('apellido', form.apellido);
            localStorage.setItem('dni', form.dni);
            localStorage.setItem('correo', form.correo);
            localStorage.setItem('telefono', form.telefono);
            localStorage.setItem('usuario', form.usuario);

            setEditando(false);
            setMensaje('Perfil actualizado correctamente ✅');

        } catch (err) {
            console.error(err);
            setMensaje('Ocurrió un error al guardar los cambios ❌');
        } finally {
            setGuardando(false);
        }
    };

    const handleCancelar = () => {
        setForm({
            nombre: localStorage.getItem('nombre') || '',
            apellido: localStorage.getItem('apellido') || '',
            dni: localStorage.getItem('dni') || '',
            correo: localStorage.getItem('correo') || '',
            telefono: localStorage.getItem('telefono') || '',
            usuario: localStorage.getItem('usuario') || ''
        });
        setEditando(false);
        setMensaje('');
    };

    // ------------------ Datos del club (ubicación / horarios) ------------------
    const handleGuardarClub = async () => {
        setGuardandoClub(true);
        setMensajeClub('');

        try {
            const res = await apiFetch(`/club/${clubId}`, {
                method: 'PUT',
                body: JSON.stringify(formClub)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error al actualizar');

            setEditandoClub(false);
            setMensajeClub('Datos del club actualizados correctamente ✅');

        } catch (err) {
            console.error(err);
            setMensajeClub('Ocurrió un error al guardar los cambios ❌');
        } finally {
            setGuardandoClub(false);
        }
    };

    const handleCancelarClub = () => {
        cargarClub();
        setEditandoClub(false);
        setMensajeClub('');
    };

    // ------------------ Seguridad: cambiar contraseña ------------------
    const handleChangePassword = (e) => {
        setFormPassword({ ...formPassword, [e.target.name]: e.target.value });
    };

    const handleGuardarPassword = async () => {
        setMensajePassword('');

        const { passwordActual, passwordNueva, passwordConfirmar } = formPassword;

        if ((tieneContrasena && !passwordActual) || !passwordNueva || !passwordConfirmar) {
            setMensajePassword('Completá los campos ❌');
            return;
        }

        if (passwordNueva.length < 6) {
            setMensajePassword('La nueva contraseña debe tener al menos 6 caracteres ❌');
            return;
        }

        if (passwordNueva !== passwordConfirmar) {
            setMensajePassword('La confirmación no coincide con la nueva contraseña ❌');
            return;
        }

        setGuardandoPassword(true);

        try {
            const res = await apiFetch(`/usuarios/${usuarioId}/password`, {
                method: 'PUT',
                body: JSON.stringify({ passwordActual, passwordNueva })
            });

            const data = await res.json();

            if (!res.ok) {
                setMensajePassword(`${data.message || 'No se pudo cambiar la contraseña'} ❌`);
                return;
            }

            setMensajePassword(`${data.message || 'Contraseña actualizada correctamente'} ✅`);
            setFormPassword({ passwordActual: '', passwordNueva: '', passwordConfirmar: '' });
            setEditandoPassword(false);
            setTieneContrasena(true);

        } catch (err) {
            console.error('Error al cambiar contraseña:', err);
            setMensajePassword('Error al conectar con el servidor ❌');
        } finally {
            setGuardandoPassword(false);
        }
    };

    const handleCancelarPassword = () => {
        setFormPassword({ passwordActual: '', passwordNueva: '', passwordConfirmar: '' });
        setEditandoPassword(false);
        setMensajePassword('');
    };

    // ------------------ Carrusel de fotos del club ------------------
    const cargarFotos = async (idClub) => {
        try {
            const res = await apiFetch(`/club/fotos?id_club=${idClub}`);
            const data = await res.json();
            if (res.ok) setFotos(data);
        } catch (err) {
            console.error('Error al cargar fotos del club:', err);
        }
    };

    const handleFotoAnterior = () => {
        setFotoIndex((prev) => (prev === 0 ? fotos.length - 1 : prev - 1));
    };

    const handleFotoSiguiente = () => {
        setFotoIndex((prev) => (prev === fotos.length - 1 ? 0 : prev + 1));
    };

    const handleSubirFotoClub = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo || !clubId) return;

        setSubiendoFotoClub(true);
        try {
            const formData = new FormData();
            formData.append('foto', archivo);
            formData.append('id_club', clubId);

            const res = await apiFetch('/club/fotos/upload', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || 'No se pudo subir la foto');
                return;
            }

            setFotos((prev) => {
                const nuevas = [...prev, data];
                setFotoIndex(nuevas.length - 1);
                return nuevas;
            });

        } catch (err) {
            console.error('Error al subir foto del club:', err);
            alert('Error al conectar con el servidor');
        } finally {
            setSubiendoFotoClub(false);
        }
    };

    const handleEliminarFotoActual = async () => {
        const fotoActual = fotos[fotoIndex];
        if (!fotoActual) return;

        const confirmar = window.confirm('¿Eliminar esta foto del club?');
        if (!confirmar) return;

        try {
            const res = await apiFetch(`/club/fotos/${fotoActual.id_foto}`, {
                method: 'DELETE'
            });

            if (!res.ok) return;

            setFotos((prev) => {
                const nuevas = prev.filter((f) => f.id_foto !== fotoActual.id_foto);
                setFotoIndex((idx) => Math.min(idx, Math.max(nuevas.length - 1, 0)));
                return nuevas;
            });

        } catch (err) {
            console.error('Error al eliminar foto del club:', err);
        }
    };

    // ------------------ Servicios adicionales ------------------
    const cargarServicios = async (idClub) => {
        try {
            const res = await apiFetch(`/club/servicios?id_club=${idClub}`);
            const data = await res.json();
            if (res.ok) setServicios(data);
        } catch (err) {
            console.error('Error al cargar servicios del club:', err);
        }
    };

    const handleAgregarServicio = async () => {
        const nombre = nuevoServicio.trim();
        if (!nombre || !clubId) return;

        setAgregandoServicio(true);
        try {
            const res = await apiFetch('/club/servicios', {
                method: 'POST',
                body: JSON.stringify({ id_club: clubId, nombre })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.message || 'No se pudo agregar el servicio');
                return;
            }

            setServicios((prev) => [...prev, { id_servicio: data.id_servicio, nombre }]);
            setNuevoServicio('');

        } catch (err) {
            console.error('Error al agregar servicio:', err);
        } finally {
            setAgregandoServicio(false);
        }
    };

    const handleEliminarServicio = async (idServicio) => {
        try {
            const res = await apiFetch(`/club/servicios/${idServicio}`, {
                method: 'DELETE'
            });

            if (!res.ok) return;

            setServicios((prev) => prev.filter((s) => s.id_servicio !== idServicio));

        } catch (err) {
            console.error('Error al eliminar servicio:', err);
        }
    };

    // ------------------ Días y horario de atención ------------------
    const cargarDiasAtencion = async (idClub) => {
        try {
            const res = await apiFetch(`/club/dias-atencion?id_club=${idClub}`);
            const data = await res.json();
            if (!res.ok) return;

            setDiasAtencion(NOMBRES_DIAS.map((_, numeroDia) => {
                const guardado = data.find((d) => d.numero_dia === numeroDia);
                return guardado
                    ? { abierto: true, hora_apertura: guardado.hora_apertura.slice(0, 5), hora_cierre: guardado.hora_cierre.slice(0, 5) }
                    : diaVacio();
            }));
        } catch (err) {
            console.error('Error al cargar días de atención:', err);
        }
    };

    const handleCambiarDia = (numeroDia, cambios) => {
        setDiasAtencion((prev) => prev.map((d, i) => i === numeroDia ? { ...d, ...cambios } : d));
    };

    const handleGuardarDia = async (numeroDia) => {
        setErrorDias('');
        const dia = diasAtencion[numeroDia];

        if (dia.abierto && dia.hora_apertura >= dia.hora_cierre) {
            setErrorDias('La hora de apertura debe ser anterior a la de cierre');
            return;
        }

        setGuardandoDia(numeroDia);
        try {
            if (dia.abierto) {
                const res = await apiFetch('/club/dias-atencion', {
                    method: 'PUT',
                    body: JSON.stringify({
                        id_club: clubId,
                        numero_dia: numeroDia,
                        hora_apertura: dia.hora_apertura,
                        hora_cierre: dia.hora_cierre
                    })
                });
                const data = await res.json();
                if (!res.ok) {
                    setErrorDias(data.message || 'No se pudo guardar el día');
                }
            } else {
                await apiFetch(`/club/dias-atencion/${clubId}/${numeroDia}`, { method: 'DELETE' });
            }
        } catch (err) {
            console.error('Error al guardar día de atención:', err);
            setErrorDias('Error al conectar con el servidor');
        } finally {
            setGuardandoDia(null);
        }
    };

    const esClub = Number(rol) === 2;

    // Ícono aproximado según el nombre del servicio (texto libre cargado por el club)
    // ------------------ Bloques reutilizables ------------------

    const avatarConSubida = (
        <div className="avatar-perfil-wrapper">
            {foto ? (
                <img src={foto} alt="Foto de perfil" className="foto-perfil-header" />
            ) : (
                <div className="avatar-perfil-header">
                    {form.nombre ? form.nombre.charAt(0).toUpperCase() : '?'}
                </div>
            )}
            <label className="btn-cambiar-foto-perfil" title={foto ? 'Cambiar foto' : 'Subir foto de perfil'}>
                {subiendoFotoPerfil ? '…' : '📷'}
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleSubirFotoPerfil}
                    disabled={subiendoFotoPerfil}
                    hidden
                />
            </label>
        </div>
    );

    const bloqueFormulario = (
        <div className="tarjeta-perfil">

            <CampoPerfil icon={faUser} label={esClub ? 'Nombre del dueño' : 'Nombre'} name="nombre" value={form.nombre} editando={editando} onChange={handleChange} />
            <CampoPerfil icon={faUser} label={esClub ? 'Apellido del dueño' : 'Apellido'} name="apellido" value={form.apellido} editando={editando} onChange={handleChange} />
            <CampoPerfil icon={faIdCard} label="Nombre de usuario" name="usuario" value={form.usuario} editando={editando} onChange={handleChange} />
            <CampoPerfil icon={faIdCard} label="DNI" name="dni" value={form.dni} editando={editando} onChange={handleChange} />
            <CampoPerfil icon={faEnvelope} label="Correo" name="correo" value={form.correo} editando={editando} onChange={handleChange} type="email" />
            <CampoPerfil icon={faPhone} label="Teléfono" name="telefono" value={form.telefono} editando={editando} onChange={handleChange} type="tel" />

            {mensaje && <p className="mensaje-perfil">{mensaje}</p>}

            <div className="acciones-perfil">
                {editando ? (
                    <>
                        <button className="btn-guardar" onClick={handleGuardar} disabled={guardando}>
                            {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button className="btn-cancelar" onClick={handleCancelar}>
                            Cancelar
                        </button>
                    </>
                ) : (
                    <button className="btn-editar" onClick={() => setEditando(true)}>
                        Editar perfil
                    </button>
                )}
            </div>

            {Number(rol) === 3 && (
                <button className="btn-mis-turnos" onClick={() => navigate('/mis-turnos')}>
                    Ver mis turnos
                </button>
            )}

        </div>
    );

    const bloqueSeguridad = (
        <div className="tarjeta-perfil tarjeta-seguridad panel-colapsable">
            <button
                type="button"
                className="panel-colapsable-header titulo-seguridad"
                onClick={() => setAbiertoSeguridad(!abiertoSeguridad)}
            >
                <span><FontAwesomeIcon icon={faShieldHalved} /> Seguridad</span>
                <FontAwesomeIcon icon={abiertoSeguridad ? faChevronUp : faChevronDown} className="panel-colapsable-flecha" />
            </button>

            {abiertoSeguridad && (
                <div className="panel-colapsable-body panel-colapsable-body-seguridad">
                    {!tieneContrasena && (
                        <p className="aviso-sin-password">
                            Iniciaste sesión con Google y todavía no tenés una contraseña propia.
                            Creá una para poder ingresar también con tu usuario o correo.
                        </p>
                    )}

                    {!editandoPassword ? (
                        <button className="btn-cambiar-password" onClick={() => setEditandoPassword(true)}>
                            {tieneContrasena ? 'Cambiar contraseña' : 'Crear contraseña'}
                        </button>
                    ) : (
                        <>
                            {tieneContrasena && (
                                <fieldset className="campo">
                                    <legend>Contraseña actual</legend>
                                    <input
                                        type="password"
                                        name="passwordActual"
                                        value={formPassword.passwordActual}
                                        onChange={handleChangePassword}
                                    />
                                </fieldset>
                            )}

                            <fieldset className="campo">
                                <legend>Nueva contraseña</legend>
                                <input
                                    type="password"
                                    name="passwordNueva"
                                    value={formPassword.passwordNueva}
                                    onChange={handleChangePassword}
                                />
                            </fieldset>

                            <fieldset className="campo">
                                <legend>Confirmar nueva contraseña</legend>
                                <input
                                    type="password"
                                    name="passwordConfirmar"
                                    value={formPassword.passwordConfirmar}
                                    onChange={handleChangePassword}
                                />
                            </fieldset>

                            {mensajePassword && <p className="mensaje-perfil">{mensajePassword}</p>}

                            <div className="acciones-perfil">
                                <button className="btn-guardar" onClick={handleGuardarPassword} disabled={guardandoPassword}>
                                    {guardandoPassword ? 'Guardando...' : (tieneContrasena ? 'Guardar nueva contraseña' : 'Crear contraseña')}
                                </button>
                                <button className="btn-cancelar" onClick={handleCancelarPassword}>
                                    Cancelar
                                </button>
                            </div>
                        </>
                    )}

                    {mensajePassword && !editandoPassword && (
                        <p className="mensaje-perfil">{mensajePassword}</p>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <>
            <NavBar />

            <div className={`contenedor-perfil ${esClub ? 'contenedor-perfil-club' : ''}`}>

                {avisoPerfilIncompleto && (
                    <div className="aviso-perfil-incompleto">
                        <span>{avisoPerfilIncompleto}</span>
                        <button
                            type="button"
                            className="btn-cerrar-aviso-perfil"
                            onClick={() => setAvisoPerfilIncompleto('')}
                            aria-label="Cerrar aviso"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {!esClub && (
                    <>
                        <div className="encabezado-perfil">
                            {avatarConSubida}
                            <h2 className="nombre-perfil-header">{form.nombre} {form.apellido}</h2>
                            <span className="correo-perfil-header">{form.correo}</span>
                        </div>
                        {bloqueFormulario}
                        {bloqueSeguridad}
                    </>
                )}

                {esClub && (
                    <>
                        {/* ------------------ Fila 1: perfil + carrusel ------------------ */}
                        <div className="perfil-club-fila">
                            <div className="perfil-club-columna">
                                <div className="encabezado-perfil encabezado-perfil-club">
                                    {avatarConSubida}
                                    <h2 className="nombre-perfil-header">{form.nombre} {form.apellido}</h2>
                                    <span className="correo-perfil-header">{form.correo}</span>
                                </div>
                                {bloqueFormulario}
                                {bloqueSeguridad}
                            </div>

                            <div className="perfil-club-columna">
                                <div className="tarjeta-perfil tarjeta-carrusel">
                                    <h3 className="titulo-seccion-club titulo-con-linea">Carrusel de fotos</h3>

                                    {fotos.length > 0 ? (
                                        <div className="carrusel-fotos">
                                            <img
                                                src={fotos[fotoIndex]?.url}
                                                alt={`Foto ${fotoIndex + 1} del club`}
                                                className="carrusel-imagen"
                                            />

                                            {fotos.length > 1 && (
                                                <>
                                                    <button type="button" className="carrusel-flecha carrusel-flecha-izq" onClick={handleFotoAnterior}>
                                                        ‹
                                                    </button>
                                                    <button type="button" className="carrusel-flecha carrusel-flecha-der" onClick={handleFotoSiguiente}>
                                                        ›
                                                    </button>
                                                </>
                                            )}

                                            <button type="button" className="carrusel-btn-eliminar" onClick={handleEliminarFotoActual}>
                                                🗑️
                                            </button>

                                            {fotos.length > 1 && (
                                                <div className="carrusel-puntos">
                                                    {fotos.map((_, i) => (
                                                        <span
                                                            key={i}
                                                            className={`carrusel-punto ${i === fotoIndex ? 'carrusel-punto-activo' : ''}`}
                                                            onClick={() => setFotoIndex(i)}
                                                        ></span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="carrusel-vacio">Todavía no cargaste fotos del club</div>
                                    )}

                                    {fotos.length > 1 && (
                                        <div className="carrusel-miniaturas">
                                            {fotos.map((f, i) => (
                                                <img
                                                    key={f.id_foto}
                                                    src={f.url}
                                                    alt={`Miniatura ${i + 1}`}
                                                    className={`carrusel-miniatura ${i === fotoIndex ? 'carrusel-miniatura-activa' : ''}`}
                                                    onClick={() => setFotoIndex(i)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <label className="btn-agregar-foto-carrusel">
                                        {subiendoFotoClub ? 'Subiendo...' : '+ Agregar foto'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleSubirFotoClub}
                                            disabled={subiendoFotoClub}
                                            hidden
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* ------------------ Donde estamos: mapa + paneles colapsables ------------------ */}
                        <div className="tarjeta-perfil tarjeta-donde-estamos">
                            <div className="donde-estamos-header">
                                <h3 className="titulo-seccion-club">Donde estamos</h3>
                                {!editandoClub && (
                                    <button
                                        type="button"
                                        className="btn-editar-club"
                                        onClick={() => setEditandoClub(true)}
                                        aria-label="Editar información del club"
                                        title="Editar información del club"
                                    >
                                        <FontAwesomeIcon icon={faPenToSquare} />
                                    </button>
                                )}
                            </div>

                            {cargandoClub && <p className="mensaje-perfil">Cargando datos del club...</p>}

                            {editandoClub ? (
                                <div className="form-editar-club">
                                    <fieldset className="campo">
                                        <legend>Nombre del club</legend>
                                        <input type="text" name="nombre" value={formClub.nombre} onChange={handleChangeClub} />
                                    </fieldset>

                                    <fieldset className="campo">
                                        <legend>Dirección</legend>
                                        <input type="text" name="direccion" value={formClub.direccion} onChange={handleChangeClub} />
                                    </fieldset>

                                    <fieldset className="campo">
                                        <legend>Localidad</legend>
                                        <select name="localidad" value={formClub.localidad} onChange={handleChangeClub} className="select-perfil">
                                            <option value="">Seleccioná una localidad</option>
                                            <option value="San Miguel de Tucumán">San Miguel de Tucumán</option>
                                            <option value="Yerba Buena">Yerba Buena</option>
                                            <option value="Tafí Viejo">Tafí Viejo</option>
                                        </select>
                                    </fieldset>

                                    <fieldset className="campo">
                                        <legend>Provincia</legend>
                                        <input type="text" name="provincia" value={formClub.provincia} onChange={handleChangeClub} />
                                    </fieldset>

                                    <fieldset className="campo">
                                        <legend>Teléfono del club</legend>
                                        <input type="tel" name="telefono" value={formClub.telefono} onChange={handleChangeClub} />
                                    </fieldset>

                                    <fieldset className="campo">
                                        <legend>Horarios de atención</legend>
                                        <textarea
                                            name="horarios_atencion"
                                            value={formClub.horarios_atencion}
                                            onChange={handleChangeClub}
                                            rows={4}
                                            placeholder={'Ej:\nLunes a Viernes: 7:00 a 23:00\nSábados: 8:00 a 20:00\nDomingos: 9:00 a 22:00'}
                                        />
                                    </fieldset>

                                    <fieldset className="campo">
                                        <legend>Horario nocturno (cambio de precio por luces)</legend>
                                        <input
                                            type="time"
                                            name="hora_inicio_nocturno"
                                            value={formClub.hora_inicio_nocturno}
                                            onChange={handleChangeClub}
                                        />
                                        <p className="ayuda-precio-nocturno">
                                            A partir de esta hora se cobra el precio nocturno de las canchas que lo tengan configurado (en "Mis Canchas").
                                        </p>
                                    </fieldset>

                                    {mensajeClub && <p className="mensaje-perfil">{mensajeClub}</p>}

                                    <div className="acciones-perfil">
                                        <button className="btn-guardar" onClick={handleGuardarClub} disabled={guardandoClub}>
                                            {guardandoClub ? 'Guardando...' : 'Guardar cambios'}
                                        </button>
                                        <button className="btn-cancelar" onClick={handleCancelarClub}>
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            ) : (
                            <div className="donde-estamos-grid">

                                <div className="donde-estamos-mapa">
                                    {formClub.direccion || formClub.localidad ? (
                                        <iframe
                                            title="Ubicación del club"
                                            className="mapa-club-iframe-grande"
                                            src={`https://www.google.com/maps?q=${encodeURIComponent(`${formClub.direccion}, ${formClub.localidad}`)}&output=embed`}
                                            loading="lazy"
                                        ></iframe>
                                    ) : (
                                        <p className="mensaje-perfil">Cargá una dirección para ver el mapa.</p>
                                    )}
                                </div>

                                <div className="donde-estamos-sidebar">

                                    <div className="panel-colapsable">
                                        <button
                                            type="button"
                                            className="panel-colapsable-header"
                                            onClick={() => setAbiertoUbicacion(!abiertoUbicacion)}
                                        >
                                            <span><FontAwesomeIcon icon={faLocationDot} /> Ubicación</span>
                                            <FontAwesomeIcon icon={abiertoUbicacion ? faChevronUp : faChevronDown} className="panel-colapsable-flecha" />
                                        </button>
                                        {abiertoUbicacion && (
                                            <div className="panel-colapsable-body">
                                                <p>
                                                    {formClub.direccion}
                                                    {formClub.direccion && formClub.localidad ? ', ' : ''}
                                                    {formClub.localidad}
                                                    {formClub.provincia && (formClub.direccion || formClub.localidad) ? ', ' : ''}
                                                    {formClub.provincia}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="panel-colapsable">
                                        <button
                                            type="button"
                                            className="panel-colapsable-header"
                                            onClick={() => setAbiertoHorarios(!abiertoHorarios)}
                                        >
                                            <span><FontAwesomeIcon icon={faClock} /> Horarios del Club</span>
                                            <FontAwesomeIcon icon={abiertoHorarios ? faChevronUp : faChevronDown} className="panel-colapsable-flecha" />
                                        </button>
                                        {abiertoHorarios && (
                                            <div className="panel-colapsable-body">
                                                {formClub.horarios_atencion ? (
                                                    <p className="texto-horarios">{formClub.horarios_atencion}</p>
                                                ) : (
                                                    <p className="mensaje-perfil">Todavía no cargaste los horarios. Podés hacerlo editando tu perfil.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="panel-colapsable">
                                        <button
                                            type="button"
                                            className="panel-colapsable-header"
                                            onClick={() => setAbiertoDiasAtencion(!abiertoDiasAtencion)}
                                        >
                                            <span><FontAwesomeIcon icon={faCalendarCheck} /> Días y horario de atención</span>
                                            <FontAwesomeIcon icon={abiertoDiasAtencion ? faChevronUp : faChevronDown} className="panel-colapsable-flecha" />
                                        </button>
                                        {abiertoDiasAtencion && (
                                            <div className="panel-colapsable-body">
                                                <p className="texto-ayuda-horarios-reservables">
                                                    Definí en qué días y en qué horario abre tu club. Tus clientes van a poder reservar cualquier rango dentro de ese horario (no vas a poder recibir reservas hasta que cargues al menos un día).
                                                </p>

                                                {errorDias && <p className="mensaje-perfil error-horario-reservable">{errorDias}</p>}

                                                <div className="lista-dias-atencion">
                                                    {NOMBRES_DIAS.map((nombreDia, numeroDia) => {
                                                        const dia = diasAtencion[numeroDia];
                                                        return (
                                                            <div key={numeroDia} className="fila-dia-atencion">
                                                                <label className="fila-dia-atencion-check">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={dia.abierto}
                                                                        onChange={(e) => handleCambiarDia(numeroDia, { abierto: e.target.checked })}
                                                                    />
                                                                    {nombreDia}
                                                                </label>

                                                                {dia.abierto && (
                                                                    <>
                                                                        <input
                                                                            type="time"
                                                                            value={dia.hora_apertura}
                                                                            onChange={(e) => handleCambiarDia(numeroDia, { hora_apertura: e.target.value })}
                                                                        />
                                                                        <span>a</span>
                                                                        <input
                                                                            type="time"
                                                                            value={dia.hora_cierre}
                                                                            onChange={(e) => handleCambiarDia(numeroDia, { hora_cierre: e.target.value })}
                                                                        />
                                                                    </>
                                                                )}

                                                                <button
                                                                    type="button"
                                                                    className="btn-guardar-dia"
                                                                    onClick={() => handleGuardarDia(numeroDia)}
                                                                    disabled={guardandoDia === numeroDia}
                                                                >
                                                                    {guardandoDia === numeroDia ? 'Guardando...' : 'Guardar'}
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="panel-colapsable">
                                        <button
                                            type="button"
                                            className="panel-colapsable-header"
                                            onClick={() => setAbiertoServicios(!abiertoServicios)}
                                        >
                                            <span><FontAwesomeIcon icon={faStar} /> Servicios del Club</span>
                                            <FontAwesomeIcon icon={abiertoServicios ? faChevronUp : faChevronDown} className="panel-colapsable-flecha" />
                                        </button>
                                        {abiertoServicios && (
                                            <div className="panel-colapsable-body">
                                                <div className="grid-servicios-iconos">
                                                    {servicios.length === 0 && (
                                                        <p className="mensaje-perfil">Todavía no agregaste servicios.</p>
                                                    )}
                                                    {servicios.map((s) => (
                                                        <div key={s.id_servicio} className="item-servicio-icono">
                                                            <span className="icono-servicio"><FontAwesomeIcon icon={iconoServicio(s.nombre)} /></span>
                                                            <span>{s.nombre}</span>
                                                            <button
                                                                type="button"
                                                                className="btn-quitar-servicio-icono"
                                                                onClick={() => handleEliminarServicio(s.id_servicio)}
                                                                aria-label={`Quitar ${s.nombre}`}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="agregar-servicio">
                                                    <input
                                                        type="text"
                                                        placeholder="Ej: Estacionamiento, Buffet, Vestuarios..."
                                                        value={nuevoServicio}
                                                        onChange={(e) => setNuevoServicio(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAgregarServicio())}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn-agregar-servicio"
                                                        onClick={handleAgregarServicio}
                                                        disabled={agregandoServicio || !nuevoServicio.trim()}
                                                    >
                                                        Agregar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                            )}
                        </div>
                    </>
                )}

            </div>

            <Footer />
        </>
    );
}

export default Perfil;