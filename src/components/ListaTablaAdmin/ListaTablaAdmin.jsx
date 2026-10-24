import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './ListaTablaAdmin.css';
import ModalBaja from '../Modal/ModalBaja';
import Toast from '../Toast/Toast';
import { apiFetch } from '../../api';

const LIMITE = 10;

// Guardamos acá la búsqueda/filtro/página para que, cuando el admin entra al
// detalle de un club y vuelve con "Volver al panel", la tabla no se reinicie
// (sessionStorage sobrevive a que este componente se desmonte y se vuelva a
// montar, cosa que pasa sí o sí al cambiar de ruta en React Router).
const CLAVE_FILTROS_GUARDADOS = 'admin-clubes-filtros';

function leerFiltrosGuardados() {
    try {
        const guardado = sessionStorage.getItem(CLAVE_FILTROS_GUARDADOS);
        return guardado ? JSON.parse(guardado) : null;
    } catch {
        return null;
    }
}

const ETIQUETA_ESTADO = {
    activa: { texto: 'Al día', clase: 'badge-suscripcion-activa' },
    pausada: { texto: 'Pausada', clase: 'badge-suscripcion-pausada' },
    cancelada: { texto: 'Cancelada', clase: 'badge-suscripcion-cancelada' }
};

const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function ListaTablaAdmin({ onCambioEstado }) {
    const navigate = useNavigate();
    const filtrosGuardados = leerFiltrosGuardados();

    const [clubes, setClubes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(filtrosGuardados?.pagina || 1);
    const [totalPaginas, setTotalPaginas] = useState(1);

    const [busquedaInput, setBusquedaInput] = useState(filtrosGuardados?.busquedaInput || '');
    const [busqueda, setBusqueda] = useState(filtrosGuardados?.busqueda || '');
    const [estadoFiltro, setEstadoFiltro] = useState(filtrosGuardados?.estadoFiltro || 'activo');

    const [procesandoId, setProcesandoId] = useState(null);
    const [clubEnConfirmacion, setClubEnConfirmacion] = useState(null);
    const [toast, setToast] = useState(null);

    const esPrimeraCarga = useRef(true);

    // Buscador con debounce: esperamos a que el usuario deje de tipear antes
    // de pegarle al backend, así no disparamos un pedido por cada letra.
    useEffect(() => {
        if (esPrimeraCarga.current) {
            // En el primer render no reseteamos nada: busqueda/pagina ya
            // pueden venir restauradas de sessionStorage.
            esPrimeraCarga.current = false;
            return;
        }
        const timer = setTimeout(() => {
            setBusqueda(busquedaInput.trim());
            setPagina(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [busquedaInput]);

    // Guarda la búsqueda/filtro/página para restaurarlos si el admin entra
    // al detalle de un club y vuelve con "Volver al panel".
    useEffect(() => {
        try {
            sessionStorage.setItem(
                CLAVE_FILTROS_GUARDADOS,
                JSON.stringify({ busquedaInput, busqueda, estadoFiltro, pagina })
            );
        } catch {
            // sessionStorage no disponible (ej. modo incógnito estricto): no pasa nada, simplemente no persiste.
        }
    }, [busquedaInput, busqueda, estadoFiltro, pagina]);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError('');
        try {
            const params = new URLSearchParams({
                pagina: String(pagina),
                limite: String(LIMITE),
                estado: estadoFiltro
            });
            if (busqueda) params.set('busqueda', busqueda);

            const res = await apiFetch(`/admin/clubes/buscar?${params.toString()}`);
            if (!res.ok) throw new Error('Respuesta no OK del servidor');
            const data = await res.json();
            setClubes(Array.isArray(data.clubes) ? data.clubes : []);
            setTotal(data.total || 0);
            setTotalPaginas(data.totalPaginas || 1);
        } catch (err) {
            console.error('Error al cargar los clubes:', err);
            setClubes([]);
            setError('No se pudo cargar la lista de clubes. Revisá tu conexión e intentá de nuevo.');
        } finally {
            setCargando(false);
        }
    }, [pagina, busqueda, estadoFiltro]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const handleCambioEstado = async () => {
        // Volvemos a pedirle la página actual al backend en vez de solo
        // parchear la fila: así, si el club/cliente ya no cumple el filtro
        // de estado puesto (ej. "Activos"), desaparece de la lista en vez
        // de quedarse ahí con el botón cambiado, y el total de la paginación
        // también queda bien.
        await cargar();
        // Avisa al panel para que las tarjetas y chips de arriba (que se
        // cargaron una sola vez al entrar) se refresquen también.
        onCambioEstado?.();
    };

    const handleDarBaja = async (club, motivo) => {
        if (!motivo || !motivo.trim()) return;

        setProcesandoId(club.id_club);
        try {
            const response = await apiFetch(`/clubes/${club.id_club}`, {
                method: 'DELETE',
                body: JSON.stringify({ motivo: motivo.trim() })
            });
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                await handleCambioEstado();
                setToast({
                    tipo: 'exito',
                    mensaje: data.turnos_cancelados > 0
                        ? `Club dado de baja. Se cancelaron ${data.turnos_cancelados} turno(s) futuro(s) y se avisó a cada cliente por correo.`
                        : 'Club dado de baja correctamente.'
                });
            } else {
                const data = await response.json().catch(() => ({}));
                setToast({ tipo: 'error', mensaje: data.message || 'Error al dar de baja el club' });
            }
        } catch (error) {
            console.error('Error:', error);
            setToast({ tipo: 'error', mensaje: 'Ocurrió un error al intentar dar de baja el club' });
        } finally {
            setProcesandoId(null);
            setClubEnConfirmacion(null);
        }
    };

    const handleReactivar = async (club) => {
        setProcesandoId(club.id_club);
        try {
            const response = await apiFetch(`/clubes/${club.id_club}/estado`, {
                method: 'PUT',
                body: JSON.stringify({ activo: 1 })
            });
            if (response.ok) {
                await handleCambioEstado();
                setToast({ tipo: 'exito', mensaje: 'Club reactivado correctamente.' });
            } else {
                const data = await response.json().catch(() => ({}));
                setToast({ tipo: 'error', mensaje: data.message || 'Error al reactivar el club' });
            }
        } catch (error) {
            console.error('Error:', error);
            setToast({ tipo: 'error', mensaje: 'Ocurrió un error al intentar reactivar el club' });
        } finally {
            setProcesandoId(null);
        }
    };

    const handleFiltroEstado = (valor) => {
        setEstadoFiltro(valor);
        setPagina(1);
    };

    return (
        <div className="contenedor-lista-admin">
            <h1 className="titulo-tabla-admin">Lista de Clubes</h1>

            <div className="controles-lista-admin">
                <input
                    type="text"
                    className="buscador-lista-admin"
                    placeholder="Buscar por nombre, dueño o localidad..."
                    value={busquedaInput}
                    onChange={(e) => setBusquedaInput(e.target.value)}
                />
                <select
                    className="filtro-lista-admin"
                    value={estadoFiltro}
                    onChange={(e) => handleFiltroEstado(e.target.value)}
                >
                    <option value="activo">Activos</option>
                    <option value="baja">Dados de baja</option>
                </select>
            </div>

            {cargando && <p className="mensaje-lista-admin">Cargando...</p>}
            {!cargando && error && <p className="mensaje-lista-admin mensaje-error-lista-admin">{error}</p>}
            {!cargando && !error && clubes.length === 0 && <p className="mensaje-lista-admin">No se encontraron clubes.</p>}

            {!cargando && clubes.length > 0 && (
                <div className="tabla-clubes-wrap">
                    <table className="tabla-clubes-admin">
                        <thead>
                            <tr>
                                <th>Club</th>
                                <th>Dueño</th>
                                <th>Plan</th>
                                <th>Suscripción</th>
                                <th className="centrado">Canchas</th>
                                <th>Próximo pago</th>
                                <th className="centrado">Estado</th>
                                <th className="centrado">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clubes.map((club) => {
                                const clubActivo = club.activo !== 0;
                                const enMora = !!club.en_mora;
                                const estado = !clubActivo
                                    ? null
                                    : enMora
                                        ? { texto: 'Falta de pago', clase: 'badge-suscripcion-mora' }
                                        : ETIQUETA_ESTADO[club.estado_suscripcion] || null;

                                return (
                                    <tr
                                        key={club.id_club}
                                        className={!clubActivo ? 'fila-club-baja' : ''}
                                        onClick={() => navigate(`/admin/clubes/${club.id_club}`)}
                                    >
                                        <td>
                                            <strong>{club.nombre}</strong>
                                            <br />
                                            <span className="dato-secundario">{club.localidad || '-'}</span>
                                        </td>
                                        <td>{`${club.nombre_dueno || ''} ${club.apellido_dueno || ''}`.trim() || club.dueno || '-'}</td>
                                        <td>{club.plan || '-'}</td>
                                        <td>{estado ? <span className={`badge-suscripcion ${estado.clase}`}>{estado.texto}</span> : <span className="dato-secundario">–</span>}</td>
                                        <td className="centrado">{club.cantidad_canchas ?? 0}</td>
                                        <td>{formatearFecha(club.proxima_fecha_pago)}</td>
                                        <td className="centrado">
                                            <span className={`badge-estado-club ${clubActivo ? 'badge-estado-club-activo' : 'badge-estado-club-baja'}`}>
                                                {clubActivo ? 'Activo' : 'Dado de baja'}
                                            </span>
                                        </td>
                                        <td className="centrado" onClick={(e) => e.stopPropagation()}>
                                            {clubActivo ? (
                                                <button
                                                    type="button"
                                                    className="btn-accion-tabla btn-accion-baja"
                                                    disabled={procesandoId === club.id_club}
                                                    onClick={() => setClubEnConfirmacion(club)}
                                                >
                                                    {procesandoId === club.id_club ? '...' : 'Dar de baja'}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="btn-accion-tabla btn-accion-reactivar"
                                                    disabled={procesandoId === club.id_club}
                                                    onClick={() => handleReactivar(club)}
                                                >
                                                    {procesandoId === club.id_club ? '...' : 'Reactivar'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {!cargando && totalPaginas > 1 && (
                <div className="paginado-lista-admin">
                    <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>‹ Anterior</button>
                    <span>Página {pagina} de {totalPaginas} ({total} clubes)</span>
                    <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>Siguiente ›</button>
                </div>
            )}

            {clubEnConfirmacion && (
                <ModalBaja
                    show={!!clubEnConfirmacion}
                    onAccept={(motivo) => handleDarBaja(clubEnConfirmacion, motivo)}
                    onCancel={() => setClubEnConfirmacion(null)}
                    mensaje="¿Dar de baja este club? Dejará de verse en las búsquedas públicas, pero podés reactivarlo cuando quieras."
                    pedirMotivo
                    procesando={procesandoId === clubEnConfirmacion.id_club}
                />
            )}

            <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
        </div>
    );
}

export default ListaTablaAdmin;
