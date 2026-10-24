import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import Toast from '../Toast/Toast';
import '../Modal/ModalConfirmacion.css';
import './Resenas.css';

function Estrellas({ puntuacion, interactivo, onElegir }) {
    const valor = Math.round(puntuacion || 0);
    return (
        <span className={`estrellas ${interactivo ? 'estrellas-interactivas' : ''}`}>
            {[1, 2, 3, 4, 5].map((n) => (
                <span
                    key={n}
                    className={n <= valor ? 'estrella-llena' : 'estrella-vacia'}
                    onClick={interactivo ? () => onElegir(n) : undefined}
                >
                    ★
                </span>
            ))}
        </span>
    );
}

function Resenas({ idClub, onCambio }) {
    const rol = localStorage.getItem('rol');
    const miId = Number(localStorage.getItem('id'));
    const esCliente = Number(rol) === 3;

    const [resenas, setResenas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState('');
    const [puntuacionForm, setPuntuacionForm] = useState(0);
    const [comentarioForm, setComentarioForm] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);
    const [resenaAEliminar, setResenaAEliminar] = useState(null);
    const [eliminando, setEliminando] = useState(false);

    const cargarResenas = async () => {
        setCargando(true);
        setErrorCarga('');
        try {
            const res = await apiFetch(`/clubes/${idClub}/resenas`);
            if (!res.ok) {
                setErrorCarga('No se pudieron cargar las reseñas');
                return;
            }
            const data = await res.json();
            setResenas(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error al cargar las reseñas:', err);
            setErrorCarga('No se pudieron cargar las reseñas');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarResenas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idClub]);

    const miResena = esCliente ? resenas.find((r) => r.id_usuario === miId) : null;

    useEffect(() => {
        if (miResena) {
            setPuntuacionForm(miResena.puntuacion);
            setComentarioForm(miResena.comentario || '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [miResena?.id_resena]);

    const handleEnviar = async (e) => {
        e.preventDefault();
        if (!puntuacionForm) {
            setError('Elegí una puntuación de 1 a 5 estrellas');
            return;
        }

        setGuardando(true);
        setError('');
        try {
            const res = await apiFetch(`/clubes/${idClub}/resenas`, {
                method: 'POST',
                body: JSON.stringify({ puntuacion: puntuacionForm, comentario: comentarioForm.trim() })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.message || 'No se pudo guardar la reseña');
                return;
            }

            setToast({ tipo: 'exito', mensaje: miResena ? 'Reseña actualizada' : 'Reseña publicada' });
            await cargarResenas();
            onCambio?.();

        } catch (err) {
            console.error('Error al guardar la reseña:', err);
            setError('Error al conectar con el servidor');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminar = async () => {
        if (!resenaAEliminar) return;

        setEliminando(true);
        try {
            const res = await apiFetch(`/resenas/${resenaAEliminar}`, { method: 'DELETE' });
            if (res.ok) {
                setPuntuacionForm(0);
                setComentarioForm('');
                setToast({ tipo: 'exito', mensaje: 'Reseña eliminada' });
                await cargarResenas();
                onCambio?.();
            } else {
                setToast({ tipo: 'error', mensaje: 'No se pudo eliminar la reseña' });
            }
        } catch (err) {
            console.error('Error al eliminar la reseña:', err);
            setToast({ tipo: 'error', mensaje: 'Error al conectar con el servidor' });
        } finally {
            setEliminando(false);
            setResenaAEliminar(null);
        }
    };

    const esAdmin = Number(rol) === 1;

    return (
        <div className="seccion-resenas">
            <h2 className="titulo-seccion-resenas">Reseñas</h2>

            {cargando && <p className="mensaje-resenas-vacio">Cargando reseñas...</p>}

            {!cargando && errorCarga && (
                <p className="mensaje-resenas-vacio error-form-resena">{errorCarga}</p>
            )}

            {!cargando && !errorCarga && resenas.length === 0 && (
                <p className="mensaje-resenas-vacio">Todavía no hay reseñas de este club.</p>
            )}

            {!cargando && !errorCarga && resenas.length > 0 && (
                <div className="lista-resenas">
                    {resenas.map((r) => (
                        <div key={r.id_resena} className="item-resena">
                            <div className="item-resena-header">
                                <span className="item-resena-nombre">
                                    {r.nombre ? `${r.nombre} ${r.apellido || ''}`.trim() : r.usuario}
                                </span>
                                <Estrellas puntuacion={r.puntuacion} />
                                <span className="item-resena-fecha">
                                    {new Date(r.fecha).toLocaleDateString('es-AR')}
                                </span>
                                {(r.id_usuario === miId || esAdmin) && (
                                    <button type="button" className="btn-eliminar-resena" onClick={() => setResenaAEliminar(r.id_resena)}>
                                        Eliminar
                                    </button>
                                )}
                            </div>
                            {r.comentario && <p className="item-resena-comentario">{r.comentario}</p>}
                        </div>
                    ))}
                </div>
            )}

            {esCliente && (
                <form className="form-resena" onSubmit={handleEnviar}>
                    <h3>{miResena ? 'Editar mi reseña' : 'Dejar una reseña'}</h3>
                    <Estrellas puntuacion={puntuacionForm} interactivo onElegir={setPuntuacionForm} />
                    <textarea
                        value={comentarioForm}
                        onChange={(e) => setComentarioForm(e.target.value)}
                        placeholder="Contanos cómo te fue (opcional)"
                        rows={3}
                    />
                    {error && <p className="error-form-resena">{error}</p>}
                    <button type="submit" disabled={guardando}>
                        {guardando ? 'Guardando...' : miResena ? 'Actualizar reseña' : 'Publicar reseña'}
                    </button>
                </form>
            )}

            {resenaAEliminar && (
                <div className="overlay-modal" onClick={() => !eliminando && setResenaAEliminar(null)}>
                    <div className="modal-cancha" onClick={(e) => e.stopPropagation()}>
                        <h3>Eliminar reseña</h3>
                        <p>¿Seguro que querés eliminar esta reseña? Esta acción no se puede deshacer.</p>
                        <div className="modal-cancha-botones">
                            <button type="button" className="btn-modal-cancelar" onClick={() => setResenaAEliminar(null)} disabled={eliminando}>
                                No, volver
                            </button>
                            <button type="button" className="btn-modal-eliminar" onClick={handleEliminar} disabled={eliminando}>
                                {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
        </div>
    );
}

export default Resenas;
