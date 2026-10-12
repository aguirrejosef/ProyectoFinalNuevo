import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './ListaTablaAdmin.css';
import ModalBaja from '../Modal/ModalBaja';
import { apiFetch } from '../../api';

const LIMITE = 10;

const ETIQUETA_ESTADO = {
    activa: { texto: 'Al día', clase: 'badge-suscripcion-activa' },
    pausada: { texto: 'Pausada', clase: 'badge-suscripcion-pausada' },
    cancelada: { texto: 'Cancelada', clase: 'badge-suscripcion-cancelada' }
};

const formatearFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function ListaTablaAdmin() {
    const navigate = useNavigate();

    const [clubes, setClubes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);

    const [busquedaInput, setBusquedaInput] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState('activo');

    const [procesandoId, setProcesandoId] = useState(null);
    const [clubEnConfirmacion, setClubEnConfirmacion] = useState(null);

    // Buscador con debounce: esperamos a que el usuario deje de tipear antes
    // de pegarle al backend, así no disparamos un pedido por cada letra.
    useEffect(() => {
        const timer = setTimeout(() => {
            setBusqueda(busquedaInput.trim());
            setPagina(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [busquedaInput]);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const params = new URLSearchParams({
                pagina: String(pagina),
                limite: String(LIMITE),
                estado: estadoFiltro
            });
            if (busqueda) params.set('busqueda', busqueda);

            const res = await apiFetch(`/admin/clubes/buscar?${params.toString()}`);
            const data = await res.json();
            setClubes(Array.isArray(data.clubes) ? data.clubes : []);
            setTotal(data.total || 0);
            setTotalPaginas(data.totalPaginas || 1);
        } catch (error) {
            console.error('Error al cargar los clubes:', error);
        } finally {
            setCargando(false);
        }
    }, [pagina, busqueda, estadoFiltro]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const handleCambioEstado = (idClub, activo) => {
        setClubes((actuales) => actuales.map((c) => (c.id_club === idClub ? { ...c, activo } : c)));
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
                handleCambioEstado(club.id_club, 0);
                if (data.turnos_cancelados > 0) {
                    alert(`Club dado de baja. Se cancelaron ${data.turnos_cancelados} turno(s) futuro(s) y se avisó a cada cliente por correo.`);
                }
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'Error al dar de baja el club');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al intentar dar de baja el club');
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
                handleCambioEstado(club.id_club, 1);
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'Error al reactivar el club');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al intentar reactivar el club');
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
            {!cargando && clubes.length === 0 && <p className="mensaje-lista-admin">No se encontraron clubes.</p>}

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
                />
            )}
        </div>
    );
}

export default ListaTablaAdmin;
