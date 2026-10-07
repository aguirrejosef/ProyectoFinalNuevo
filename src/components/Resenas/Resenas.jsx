import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
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

function Resenas({ idClub }) {
    const rol = localStorage.getItem('rol');
    const miId = Number(localStorage.getItem('id'));
    const esCliente = Number(rol) === 3;

    const [resenas, setResenas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [puntuacionForm, setPuntuacionForm] = useState(0);
    const [comentarioForm, setComentarioForm] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const cargarResenas = async () => {
        setCargando(true);
        try {
            const res = await apiFetch(`/clubes/${idClub}/resenas`);
            const data = await res.json();
            setResenas(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error al cargar las reseñas:', err);
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

            await cargarResenas();

        } catch (err) {
            console.error('Error al guardar la reseña:', err);
            setError('Error al conectar con el servidor');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminar = async (idResena) => {
        try {
            const res = await apiFetch(`/resenas/${idResena}`, { method: 'DELETE' });
            if (res.ok) {
                setPuntuacionForm(0);
                setComentarioForm('');
                await cargarResenas();
            }
        } catch (err) {
            console.error('Error al eliminar la reseña:', err);
        }
    };

    const esAdmin = Number(rol) === 1;

    return (
        <div className="seccion-resenas">
            <h2 className="titulo-seccion-resenas">Reseñas</h2>

            {cargando && <p className="mensaje-resenas-vacio">Cargando reseñas...</p>}

            {!cargando && resenas.length === 0 && (
                <p className="mensaje-resenas-vacio">Todavía no hay reseñas de este club.</p>
            )}

            {!cargando && resenas.length > 0 && (
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
                                    <button type="button" className="btn-eliminar-resena" onClick={() => handleEliminar(r.id_resena)}>
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
        </div>
    );
}

export default Resenas;
