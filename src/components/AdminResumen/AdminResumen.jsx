import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import './AdminResumen.css';

const formatearMoneda = (monto) => `$${Math.round(monto).toLocaleString('es-AR')}`;

function AdminResumen({ mostrandoClubes = true, refrescar }) {
    const [clubes, setClubes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [ingresoTotal, setIngresoTotal] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const cargar = async () => {
            try {
                const [resClubes, resUsuarios, resIngresos] = await Promise.all([
                    apiFetch('/admin/clubes'),
                    apiFetch('/usuarios'),
                    apiFetch('/admin/ingresos-planes')
                ]);
                if (!resClubes.ok || !resUsuarios.ok || !resIngresos.ok) {
                    throw new Error('Respuesta no OK del servidor');
                }
                const dataClubes = await resClubes.json();
                const dataUsuarios = await resUsuarios.json();
                const dataIngresos = await resIngresos.json();
                setClubes(Array.isArray(dataClubes) ? dataClubes : []);
                setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
                setIngresoTotal(Number(dataIngresos?.total) || 0);
                setError('');
            } catch (err) {
                console.error('Error al cargar el resumen de admin:', err);
                setError('No se pudo cargar el resumen. Revisá tu conexión e intentá de nuevo.');
            } finally {
                setCargando(false);
            }
        };

        cargar();
        // No reseteamos "cargando" acá: solo se usa para el loader inicial,
        // así un refresco por un alta/baja no hace parpadear las tarjetas.
    }, [refrescar]);

    if (cargando) {
        return <p className="mensaje-resumen-admin">Cargando resumen...</p>;
    }

    if (error) {
        return <p className="mensaje-resumen-admin mensaje-resumen-admin-error">{error}</p>;
    }

    // Igual que "Clubes activos"/"Canchas activas": contamos cuentas activas,
    // no el total histórico incluyendo las dadas de baja.
    const totalClientes = usuarios.filter((u) => u.id_rol === 3 && u.activo !== 0).length;
    const totalAdmins = usuarios.filter((u) => u.id_rol === 1 && u.activo !== 0).length;
    const clientesDadosDeBaja = usuarios.filter((u) => u.id_rol === 3 && u.activo === 0).length;

    // "Activo" acá es la baja lógica del club (lo dio de baja el admin o no),
    // algo independiente de si la suscripción está al día/pausada/cancelada.
    const clubesNoDadosDeBaja = clubes.filter((c) => c.activo !== 0);
    const totalCanchasActivas = clubesNoDadosDeBaja.reduce((total, c) => total + (Number(c.cantidad_canchas) || 0), 0);

    // Estos tres son mutuamente excluyentes y cubren TODOS los clubes:
    // primero se mira si el admin lo dio de baja (no importa el motivo),
    // y recién si sigue activo se mira cómo anda su pago.
    const clubesActivos = clubes.filter((c) => c.activo !== 0 && c.estado_suscripcion === 'activa' && !c.en_mora).length;
    const clubesConProblemaDePago = clubes.filter((c) =>
        c.activo !== 0 && (c.estado_suscripcion === 'pausada' || c.estado_suscripcion === 'cancelada' || c.en_mora)
    ).length;
    const clubesDadosDeBaja = clubes.filter((c) => c.activo === 0).length;

    return (
        <div className="resumen-admin">
            <div className="grid-tarjetas-resumen">
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{clubesNoDadosDeBaja.length}</span>
                    <span className="tarjeta-resumen-label">Clubes activos</span>
                </div>
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{totalClientes}</span>
                    <span className="tarjeta-resumen-label">Clientes</span>
                </div>
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{totalCanchasActivas}</span>
                    <span className="tarjeta-resumen-label">Canchas activas</span>
                </div>
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{totalAdmins}</span>
                    <span className="tarjeta-resumen-label">Administradores</span>
                </div>
                <div className="tarjeta-resumen tarjeta-resumen-destacada">
                    <span className="tarjeta-resumen-valor">{formatearMoneda(ingresoTotal)}</span>
                    <span className="tarjeta-resumen-label">Ingreso por planes este mes</span>
                </div>
            </div>

            {mostrandoClubes ? (
                <div className="fila-suscripciones-resumen">
                    <div className="chip-suscripcion chip-suscripcion-activa">{clubesActivos} Al día</div>
                    <div className="chip-suscripcion chip-suscripcion-pausada">{clubesConProblemaDePago} Con problema de pago</div>
                    <div className="chip-suscripcion chip-suscripcion-cancelada">{clubesDadosDeBaja} Dados de baja</div>
                </div>
            ) : (
                <div className="fila-suscripciones-resumen">
                    <div className="chip-suscripcion chip-suscripcion-activa">{totalClientes} Activos</div>
                    <div className="chip-suscripcion chip-suscripcion-cancelada">{clientesDadosDeBaja} Dados de baja</div>
                </div>
            )}

        </div>
    );
}

export default AdminResumen;
