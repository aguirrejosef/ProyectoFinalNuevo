import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import './MisCanchas.css';
import { apiFetch } from '../../api';

function MisCanchas() {
    const navigate = useNavigate();

    const [club, setClub] = useState(null);
    const [canchas, setCanchas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [canchaEditando, setCanchaEditando] = useState(null);
    const [canchaEliminando, setCanchaEliminando] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [errorModal, setErrorModal] = useState('');
    const [fotosConError, setFotosConError] = useState(new Set());

    const [agregandoCancha, setAgregandoCancha] = useState(false);
    const [nuevaCancha, setNuevaCancha] = useState({ nombre: '', tipo: '', foto: '', precio: '' });
    const [subiendoFoto, setSubiendoFoto] = useState(false);

    const handleErrorFoto = (idCancha) => {
        setFotosConError((prev) => new Set(prev).add(idCancha));
    };

    const idUsuario = localStorage.getItem('id');
    const rol = localStorage.getItem('rol');

    useEffect(() => {
        if (!rol || !idUsuario) {
            navigate('/login');
            return;
        }
        if (Number(rol) !== 2) {
            navigate('/');
            return;
        }

        cargarDatos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargarDatos = async () => {
        setLoading(true);
        setError('');

        try {
            const resClub = await apiFetch('/club/mi-club');
            const dataClub = await resClub.json();

            if (!resClub.ok) {
                setError(dataClub.message || 'No se pudo cargar tu club');
                setLoading(false);
                return;
            }

            setClub(dataClub);

            const resCanchas = await apiFetch(`/club/canchas?id_club=${dataClub.id_club}`);
            const dataCanchas = await resCanchas.json();

            if (!resCanchas.ok) {
                setError(dataCanchas.message || 'No se pudieron cargar las canchas');
                setLoading(false);
                return;
            }

            setCanchas(dataCanchas);

        } catch (err) {
            console.error('Error al cargar mis canchas:', err);
            setError('Error al conectar con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleEstado = async (cancha) => {
        const nuevoEstado = cancha.estado === 'disponible' ? 'inactiva' : 'disponible';

        try {
            const res = await apiFetch(`/canchas/${cancha.id_cancha}/estado`, {
                method: 'PUT',
                body: JSON.stringify({ estado: nuevoEstado })
            });

            if (!res.ok) return;

            setCanchas((prev) =>
                prev.map((c) => c.id_cancha === cancha.id_cancha ? { ...c, estado: nuevoEstado } : c)
            );
        } catch (err) {
            console.error('Error al cambiar estado:', err);
        }
    };

    const handleGuardarEdicion = async (e) => {
        e.preventDefault();
        setGuardando(true);
        setErrorModal('');

        try {
            const res = await apiFetch(`/canchas/${canchaEditando.id_cancha}`, {
                method: 'PUT',
                body: JSON.stringify({
                    nombre: canchaEditando.nombre,
                    tipo: canchaEditando.tipo,
                    foto: canchaEditando.foto,
                    precio: canchaEditando.precio
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorModal(data.message || 'No se pudo guardar');
                setGuardando(false);
                return;
            }

            setCanchas((prev) =>
                prev.map((c) => c.id_cancha === canchaEditando.id_cancha ? canchaEditando : c)
            );
            setCanchaEditando(null);

        } catch (err) {
            console.error('Error al editar cancha:', err);
            setErrorModal('Error al conectar con el servidor');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminar = async () => {
        setGuardando(true);
        setErrorModal('');

        try {
            const res = await apiFetch(`/canchas/${canchaEliminando.id_cancha}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorModal(data.message || 'No se pudo eliminar');
                setGuardando(false);
                return;
            }

            setCanchas((prev) => prev.filter((c) => c.id_cancha !== canchaEliminando.id_cancha));
            setCanchaEliminando(null);

        } catch (err) {
            console.error('Error al eliminar cancha:', err);
            setErrorModal('Error al conectar con el servidor');
        } finally {
            setGuardando(false);
        }
    };

    const handleAbrirAgregar = () => {
        setNuevaCancha({ nombre: '', tipo: '', foto: '', precio: '' });
        setErrorModal('');
        setAgregandoCancha(true);
    };

    const handleGuardarNuevaCancha = async (e) => {
        e.preventDefault();
        setGuardando(true);
        setErrorModal('');

        try {
            const res = await apiFetch('/club/canchas', {
                method: 'POST',
                body: JSON.stringify({
                    id_club: club.id_club,
                    nombre: nuevaCancha.nombre,
                    tipo: nuevaCancha.tipo,
                    foto: nuevaCancha.foto,
                    precio: nuevaCancha.precio
                })
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorModal(data.message || 'No se pudo agregar la cancha');
                setGuardando(false);
                return;
            }

            setCanchas((prev) => [
                ...prev,
                {
                    id_cancha: data.id_cancha,
                    nombre: nuevaCancha.nombre,
                    estado: 'disponible',
                    tipo: nuevaCancha.tipo,
                    foto: nuevaCancha.foto,
                    precio: nuevaCancha.precio,
                    turnos_semana: 0
                }
            ]);

            setAgregandoCancha(false);

        } catch (err) {
            console.error('Error al agregar cancha:', err);
            setErrorModal('Error al conectar con el servidor');
        } finally {
            setGuardando(false);
        }
    };

    // Sube el archivo elegido y guarda la URL devuelta en el form correspondiente
    const handleSubirFoto = async (e, setterForm, formActual) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        setSubiendoFoto(true);
        setErrorModal('');

        try {
            const formData = new FormData();
            formData.append('foto', archivo);

            const res = await apiFetch('/canchas/upload-foto', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                setErrorModal(data.message || 'No se pudo subir la foto');
                return;
            }

            setterForm({ ...formActual, foto: data.foto });

        } catch (err) {
            console.error('Error al subir la foto:', err);
            setErrorModal('Error al conectar con el servidor al subir la foto');
        } finally {
            setSubiendoFoto(false);
        }
    };

    const formatearPrecio = (precio) => {
        if (precio === null || precio === undefined || precio === '') return null;
        return Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    };

    return (
        <>
            <NavBar />

            <div className="contenedor-mis-canchas">

                <div className="header-mis-canchas">
                    <h2>Mis Canchas</h2>
                    {club && <p>{club.nombre}</p>}
                    <button type="button" className="btn-agregar-cancha" onClick={handleAbrirAgregar}>
                        + Agregar cancha
                    </button>
                </div>

                {loading && <p className="mensaje-canchas">Cargando canchas...</p>}
                {error && <p className="mensaje-canchas error-canchas">{error}</p>}

                {!loading && !error && canchas.length === 0 && (
                    <p className="mensaje-canchas">Todavía no tenés canchas cargadas.</p>
                )}

                <div className="grid-mis-canchas">
                    {canchas.map((cancha) => (
                        <div
                            key={cancha.id_cancha}
                            className={`tarjeta-cancha ${cancha.estado === 'disponible' ? 'tarjeta-cancha-disponible' : 'tarjeta-cancha-inactiva'}`}
                        >

                            <div className="tarjeta-cancha-imagen">
                                {cancha.foto && !fotosConError.has(cancha.id_cancha) ? (
                                    <img
                                        src={cancha.foto}
                                        alt={cancha.nombre}
                                        onError={() => handleErrorFoto(cancha.id_cancha)}
                                    />
                                ) : (
                                    <div className="tarjeta-cancha-imagen-placeholder">
                                        <div className="cancha-textura-lineas"></div>
                                        <span className="cancha-icono-placeholder">🎾</span>
                                    </div>
                                )}

                                <span className={`badge-estado-cancha estado-${cancha.estado}`}>
                                    {cancha.estado === 'disponible' ? 'Disponible' : 'Inactiva'}
                                </span>

                                {formatearPrecio(cancha.precio) && (
                                    <span className="badge-precio-cancha">{formatearPrecio(cancha.precio)}</span>
                                )}

                                <div className="tarjeta-cancha-overlay">
                                    <h3>{cancha.nombre}</h3>
                                    {cancha.tipo && <span className="tarjeta-cancha-tipo-overlay">{cancha.tipo}</span>}
                                </div>
                            </div>

                            <div className="tarjeta-cancha-body">

                                <div className="tarjeta-cancha-stat">
                                    📅 {cancha.turnos_semana} turno{cancha.turnos_semana === 1 ? '' : 's'} esta semana
                                </div>

                                <div className="tarjeta-cancha-acciones-iconos">
                                    <button
                                        type="button"
                                        title="Editar cancha"
                                        aria-label="Editar cancha"
                                        onClick={() => setCanchaEditando({ ...cancha })}
                                    >
                                        ✏️
                                    </button>

                                    <button
                                        type="button"
                                        title={cancha.estado === 'disponible' ? 'Desactivar cancha' : 'Activar cancha'}
                                        aria-label={cancha.estado === 'disponible' ? 'Desactivar cancha' : 'Activar cancha'}
                                        onClick={() => handleToggleEstado(cancha)}
                                    >
                                        {cancha.estado === 'disponible' ? '⏸️' : '▶️'}
                                    </button>

                                    <button
                                        type="button"
                                        title="Eliminar cancha"
                                        aria-label="Eliminar cancha"
                                        className="btn-icono-eliminar"
                                        onClick={() => { setCanchaEliminando(cancha); setErrorModal(''); }}
                                    >
                                        🗑️
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="btn-ver-turnos-principal"
                                    onClick={() => navigate(`/mis-canchas/${cancha.id_cancha}/turnos`)}
                                >
                                    Ver turnos →
                                </button>
                            </div>

                        </div>
                    ))}
                </div>

            </div>

            {/* ------------------ Modal Editar ------------------ */}
            {canchaEditando && (
                <div className="overlay-modal" onClick={() => setCanchaEditando(null)}>
                    <div className="modal-cancha" onClick={(e) => e.stopPropagation()}>
                        <h3>Editar cancha</h3>

                        <form onSubmit={handleGuardarEdicion}>
                            <label>Nombre</label>
                            <input
                                type="text"
                                value={canchaEditando.nombre}
                                onChange={(e) => setCanchaEditando({ ...canchaEditando, nombre: e.target.value })}
                                required
                            />

                            <label>Tipo de cancha</label>
                            <input
                                type="text"
                                placeholder="Ej: Cristal, Panorámica, Muro"
                                value={canchaEditando.tipo || ''}
                                onChange={(e) => setCanchaEditando({ ...canchaEditando, tipo: e.target.value })}
                            />

                            <label>Foto de la cancha</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSubirFoto(e, setCanchaEditando, canchaEditando)}
                                disabled={subiendoFoto}
                            />
                            {subiendoFoto && <p className="texto-subiendo-foto">Subiendo imagen...</p>}
                            {canchaEditando.foto && !subiendoFoto && (
                                <img src={canchaEditando.foto} alt="Vista previa" className="preview-foto-cancha" />
                            )}

                            <label>Precio por turno</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Ej: 8000"
                                value={canchaEditando.precio || ''}
                                onChange={(e) => setCanchaEditando({ ...canchaEditando, precio: e.target.value })}
                            />

                            {errorModal && <p className="error-modal-cancha">{errorModal}</p>}

                            <div className="modal-cancha-botones">
                                <button type="button" className="btn-modal-cancelar" onClick={() => setCanchaEditando(null)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-modal-guardar" disabled={guardando}>
                                    {guardando ? 'Guardando...' : 'Guardar cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------ Modal Agregar ------------------ */}
            {agregandoCancha && (
                <div className="overlay-modal" onClick={() => setAgregandoCancha(false)}>
                    <div className="modal-cancha" onClick={(e) => e.stopPropagation()}>
                        <h3>Agregar cancha</h3>

                        <form onSubmit={handleGuardarNuevaCancha}>
                            <label>Nombre</label>
                            <input
                                type="text"
                                placeholder="Ej: Cancha 5"
                                value={nuevaCancha.nombre}
                                onChange={(e) => setNuevaCancha({ ...nuevaCancha, nombre: e.target.value })}
                                required
                            />

                            <label>Tipo de cancha</label>
                            <input
                                type="text"
                                placeholder="Ej: Cristal, Panorámica, Muro"
                                value={nuevaCancha.tipo}
                                onChange={(e) => setNuevaCancha({ ...nuevaCancha, tipo: e.target.value })}
                            />

                            <label>Foto de la cancha</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleSubirFoto(e, setNuevaCancha, nuevaCancha)}
                                disabled={subiendoFoto}
                            />
                            {subiendoFoto && <p className="texto-subiendo-foto">Subiendo imagen...</p>}
                            {nuevaCancha.foto && !subiendoFoto && (
                                <img src={nuevaCancha.foto} alt="Vista previa" className="preview-foto-cancha" />
                            )}

                            <label>Precio por turno</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Ej: 8000"
                                value={nuevaCancha.precio}
                                onChange={(e) => setNuevaCancha({ ...nuevaCancha, precio: e.target.value })}
                            />

                            {errorModal && <p className="error-modal-cancha">{errorModal}</p>}

                            <div className="modal-cancha-botones">
                                <button type="button" className="btn-modal-cancelar" onClick={() => setAgregandoCancha(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn-modal-guardar" disabled={guardando}>
                                    {guardando ? 'Guardando...' : 'Agregar cancha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------ Modal Eliminar ------------------ */}
            {canchaEliminando && (
                <div className="overlay-modal" onClick={() => setCanchaEliminando(null)}>
                    <div className="modal-cancha" onClick={(e) => e.stopPropagation()}>
                        <h3>Eliminar cancha</h3>
                        <p>¿Seguro que querés eliminar <strong>{canchaEliminando.nombre}</strong>? Esta acción no se puede deshacer.</p>

                        {errorModal && <p className="error-modal-cancha">{errorModal}</p>}

                        <div className="modal-cancha-botones">
                            <button type="button" className="btn-modal-cancelar" onClick={() => setCanchaEliminando(null)}>
                                Cancelar
                            </button>
                            <button type="button" className="btn-modal-eliminar" onClick={handleEliminar} disabled={guardando}>
                                {guardando ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </>
    );
}

export default MisCanchas;