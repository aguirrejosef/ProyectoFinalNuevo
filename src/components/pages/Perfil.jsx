import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import './Perfil.css';

function Perfil() {
    const navigate = useNavigate();

    const [rol, setRol] = useState(null);
    const [usuarioId, setUsuarioId] = useState(null);
    const [foto, setFoto] = useState('');
    const [editando, setEditando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [mensaje, setMensaje] = useState('');
    const [cargandoClub, setCargandoClub] = useState(false);

    const [form, setForm] = useState({
        nombre: '',
        apellido: '',
        dni: '',
        correo: '',
        telefono: ''
    });

    // Datos propios del club (rol === 2)
    const [clubId, setClubId] = useState(null);
    const [formClub, setFormClub] = useState({
        nombre: '',
        direccion: '',
        localidad: '',
        telefono: '',
        horarios_atencion: ''
    });

    // ------------------ Seguridad: cambiar contraseña ------------------
    const [editandoPassword, setEditandoPassword] = useState(false);
    const [guardandoPassword, setGuardandoPassword] = useState(false);
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

    // ------------------ Sección "Donde estamos" (paneles colapsables) ------------------
    const [abiertoUbicacion, setAbiertoUbicacion] = useState(true);
    const [abiertoHorarios, setAbiertoHorarios] = useState(true);
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
            telefono: localStorage.getItem('telefono') || ''
        });

        // Si es club, traemos los datos del club desde el backend
        if (Number(storedRol) === 2) {
            cargarClub(idUsuario);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigate]);

    const cargarClub = async (idUsuario) => {
        setCargandoClub(true);
        try {
            const res = await fetch(`http://localhost:3000/club/mi-club?id_usuario=${idUsuario}`);
            const data = await res.json();

            if (res.ok) {
                setClubId(data.id_club);
                setFormClub({
                    nombre: data.nombre || '',
                    direccion: data.direccion || '',
                    localidad: data.localidad || '',
                    telefono: data.telefono || '',
                    horarios_atencion: data.horarios_atencion || ''
                });

                cargarFotos(data.id_club);
                cargarServicios(data.id_club);
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

    const handleChangeClub = (e) => {
        setFormClub({ ...formClub, [e.target.name]: e.target.value });
    };

    const handleGuardar = async () => {
        setGuardando(true);
        setMensaje('');

        try {
            if (Number(rol) === 2) {
                // ------ Guardar datos del club ------
                const res = await fetch(`http://localhost:3000/club/${clubId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formClub)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Error al actualizar');

            } else {
                // ------ Guardar datos del usuario/cliente ------
                const res = await fetch(`http://localhost:3000/usuarios/${usuarioId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                });

                if (!res.ok) throw new Error('Error al actualizar');

                // Sincronizamos localStorage con los nuevos datos
                localStorage.setItem('nombre', form.nombre);
                localStorage.setItem('apellido', form.apellido);
                localStorage.setItem('dni', form.dni);
                localStorage.setItem('correo', form.correo);
                localStorage.setItem('telefono', form.telefono);
            }

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
        if (Number(rol) === 2) {
            cargarClub(usuarioId);
        } else {
            setForm({
                nombre: localStorage.getItem('nombre') || '',
                apellido: localStorage.getItem('apellido') || '',
                dni: localStorage.getItem('dni') || '',
                correo: localStorage.getItem('correo') || '',
                telefono: localStorage.getItem('telefono') || ''
            });
        }
        setEditando(false);
        setMensaje('');
    };

    // ------------------ Seguridad: cambiar contraseña ------------------
    const handleChangePassword = (e) => {
        setFormPassword({ ...formPassword, [e.target.name]: e.target.value });
    };

    const handleGuardarPassword = async () => {
        setMensajePassword('');

        const { passwordActual, passwordNueva, passwordConfirmar } = formPassword;

        if (!passwordActual || !passwordNueva || !passwordConfirmar) {
            setMensajePassword('Completá los tres campos ❌');
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
            const res = await fetch(`http://localhost:3000/usuarios/${usuarioId}/password`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passwordActual, passwordNueva })
            });

            const data = await res.json();

            if (!res.ok) {
                setMensajePassword(`${data.message || 'No se pudo cambiar la contraseña'} ❌`);
                return;
            }

            setMensajePassword('Contraseña actualizada correctamente ✅');
            setFormPassword({ passwordActual: '', passwordNueva: '', passwordConfirmar: '' });
            setEditandoPassword(false);

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
            const res = await fetch(`http://localhost:3000/club/fotos?id_club=${idClub}`);
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

            const res = await fetch('http://localhost:3000/club/fotos/upload', {
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
            const res = await fetch(`http://localhost:3000/club/fotos/${fotoActual.id_foto}`, {
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
            const res = await fetch(`http://localhost:3000/club/servicios?id_club=${idClub}`);
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
            const res = await fetch('http://localhost:3000/club/servicios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await fetch(`http://localhost:3000/club/servicios/${idServicio}`, {
                method: 'DELETE'
            });

            if (!res.ok) return;

            setServicios((prev) => prev.filter((s) => s.id_servicio !== idServicio));

        } catch (err) {
            console.error('Error al eliminar servicio:', err);
        }
    };

    const esClub = Number(rol) === 2;

    // Ícono aproximado según el nombre del servicio (texto libre cargado por el club)
    const iconoServicio = (nombre) => {
        const texto = (nombre || '').toLowerCase();
        if (texto.includes('wifi')) return '📶';
        if (texto.includes('estacionamiento')) return '🅿️';
        if (texto.includes('vestuario')) return '🚻';
        if (texto.includes('cumplea')) return '🎉';
        if (texto.includes('turno')) return '📅';
        if (texto.includes('parrilla')) return '🍖';
        if (texto.includes('escuel')) return '🏫';
        if (texto.includes('bar') || texto.includes('restaur')) return '🍽️';
        if (texto.includes('quincho')) return '🏕️';
        if (texto.includes('paleta')) return '🎾';
        if (texto.includes('pileta') || texto.includes('pool')) return '🏊';
        if (texto.includes('buffet') || texto.includes('kiosco')) return '🛒';
        return '✅';
    };

    // ------------------ Bloques reutilizables ------------------

    const bloqueFormulario = (
        <div className="tarjeta-perfil">

            {esClub ? (
                <>
                    {cargandoClub && <p className="mensaje-perfil">Cargando datos del club...</p>}

                    <fieldset className="campo">
                        <legend>Nombre del club</legend>
                        <input type="text" name="nombre" value={formClub.nombre} onChange={handleChangeClub} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Dirección</legend>
                        <input type="text" name="direccion" value={formClub.direccion} onChange={handleChangeClub} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Localidad</legend>
                        {editando ? (
                            <select name="localidad" value={formClub.localidad} onChange={handleChangeClub} className="select-perfil">
                                <option value="San Miguel de Tucumán">San Miguel de Tucumán</option>
                                <option value="Yerba Buena">Yerba Buena</option>
                                <option value="Tafí Viejo">Tafí Viejo</option>
                            </select>
                        ) : (
                            <input type="text" value={formClub.localidad} disabled />
                        )}
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Teléfono del club</legend>
                        <input type="tel" name="telefono" value={formClub.telefono} onChange={handleChangeClub} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Horarios de atención</legend>
                        <textarea
                            name="horarios_atencion"
                            value={formClub.horarios_atencion}
                            onChange={handleChangeClub}
                            disabled={!editando}
                            rows={4}
                            placeholder={'Ej:\nLunes a Viernes: 7:00 a 23:00\nSábados: 8:00 a 20:00\nDomingos: 9:00 a 22:00'}
                        />
                    </fieldset>
                </>
            ) : (
                <>
                    <fieldset className="campo">
                        <legend>Nombre(s)</legend>
                        <input type="text" name="nombre" value={form.nombre} onChange={handleChange} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Apellido(s)</legend>
                        <input type="text" name="apellido" value={form.apellido} onChange={handleChange} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>DNI</legend>
                        <input type="text" name="dni" value={form.dni} onChange={handleChange} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Correo</legend>
                        <input type="email" name="correo" value={form.correo} onChange={handleChange} disabled={!editando} />
                    </fieldset>

                    <fieldset className="campo">
                        <legend>Teléfono</legend>
                        <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} disabled={!editando} />
                    </fieldset>
                </>
            )}

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
        <div className="tarjeta-perfil tarjeta-seguridad">
            <h3 className="titulo-seguridad">Seguridad</h3>

            {!editandoPassword ? (
                <button className="btn-cambiar-password" onClick={() => setEditandoPassword(true)}>
                    Cambiar contraseña
                </button>
            ) : (
                <>
                    <fieldset className="campo">
                        <legend>Contraseña actual</legend>
                        <input
                            type="password"
                            name="passwordActual"
                            value={formPassword.passwordActual}
                            onChange={handleChangePassword}
                        />
                    </fieldset>

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
                            {guardandoPassword ? 'Guardando...' : 'Guardar nueva contraseña'}
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
    );

    return (
        <>
            <NavBar />

            <div className={`contenedor-perfil ${esClub ? 'contenedor-perfil-club' : ''}`}>

                <div className="encabezado-perfil">
                    {foto ? (
                        <img src={foto} alt="Foto de perfil" className="foto-perfil-header" />
                    ) : (
                        <div className="avatar-perfil-header">
                            {form.nombre ? form.nombre.charAt(0).toUpperCase() : '?'}
                        </div>
                    )}
                    <h2 className="nombre-perfil-header">{form.nombre} {form.apellido}</h2>
                    <span className="correo-perfil-header">{form.correo}</span>
                </div>

                {!esClub && (
                    <>
                        {bloqueFormulario}
                        {bloqueSeguridad}
                    </>
                )}

                {esClub && (
                    <>
                        {/* ------------------ Fila 1: perfil + carrusel ------------------ */}
                        <div className="perfil-club-fila">
                            <div className="perfil-club-columna">
                                {bloqueFormulario}
                                {bloqueSeguridad}
                            </div>

                            <div className="perfil-club-columna">
                                <div className="tarjeta-perfil tarjeta-carrusel">
                                    <h3 className="titulo-seccion-club">Fotos del club</h3>

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
                            <h3 className="titulo-seccion-club">Donde estamos</h3>

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
                                            Ubicación
                                            <span className="panel-colapsable-flecha">{abiertoUbicacion ? '▴' : '▾'}</span>
                                        </button>
                                        {abiertoUbicacion && (
                                            <div className="panel-colapsable-body">
                                                <p>
                                                    {formClub.direccion}
                                                    {formClub.direccion && formClub.localidad ? ', ' : ''}
                                                    {formClub.localidad}
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
                                            Horarios del Club
                                            <span className="panel-colapsable-flecha">{abiertoHorarios ? '▴' : '▾'}</span>
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
                                            onClick={() => setAbiertoServicios(!abiertoServicios)}
                                        >
                                            Servicios del Club
                                            <span className="panel-colapsable-flecha">{abiertoServicios ? '▴' : '▾'}</span>
                                        </button>
                                        {abiertoServicios && (
                                            <div className="panel-colapsable-body">
                                                <div className="grid-servicios-iconos">
                                                    {servicios.length === 0 && (
                                                        <p className="mensaje-perfil">Todavía no agregaste servicios.</p>
                                                    )}
                                                    {servicios.map((s) => (
                                                        <div key={s.id_servicio} className="item-servicio-icono">
                                                            <span className="icono-servicio">{iconoServicio(s.nombre)}</span>
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
                        </div>
                    </>
                )}

            </div>
        </>
    );
}

export default Perfil;