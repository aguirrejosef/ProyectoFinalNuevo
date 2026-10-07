import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import './AdminResumen.css';

const formatearMoneda = (monto) => `$${Math.round(monto).toLocaleString('es-AR')}`;

function AdminResumen() {
    const [clubes, setClubes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [ingresoTotal, setIngresoTotal] = useState(0);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const cargar = async () => {
            try {
                const [resClubes, resUsuarios, resIngresos] = await Promise.all([
                    apiFetch('/admin/clubes'),
                    apiFetch('/usuarios'),
                    apiFetch('/admin/ingresos-planes')
                ]);
                const dataClubes = await resClubes.json();
                const dataUsuarios = await resUsuarios.json();
                const dataIngresos = await resIngresos.json();
                setClubes(Array.isArray(dataClubes) ? dataClubes : []);
                setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
                setIngresoTotal(Number(dataIngresos?.total) || 0);
            } catch (err) {
                console.error('Error al cargar el resumen de admin:', err);
            } finally {
                setCargando(false);
            }
        };

        cargar();
    }, []);

    if (cargando) {
        return <p className="mensaje-resumen-admin">Cargando resumen...</p>;
    }

    // Igual que "Clubes activos"/"Canchas activas": contamos cuentas activas,
    // no el total histórico incluyendo las dadas de baja.
    const totalClientes = usuarios.filter((u) => u.id_rol === 3 && u.activo !== 0).length;
    const totalAdmins = usuarios.filter((u) => u.id_rol === 1 && u.activo !== 0).length;

    // "Activo" acá es la baja lógica del club (lo dio de baja el admin o no),
    // algo independiente de si la suscripción está al día/pausada/cancelada.
    const clubesNoDadosDeBaja = clubes.filter((c) => c.activo !== 0);
    const totalCanchasActivas = clubesNoDadosDeBaja.reduce((total, c) => total + (Number(c.cantidad_canchas) || 0), 0);

    const clubesActivos = clubes.filter((c) => c.estado_suscripcion === 'activa').length;
    const clubesPausados = clubes.filter((c) => c.estado_suscripcion === 'pausada').length;
    const clubesCancelados = clubes.filter((c) => c.estado_suscripcion === 'cancelada').length;

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

            <div className="fila-suscripciones-resumen">
                <div className="chip-suscripcion chip-suscripcion-activa">{clubesActivos} al día</div>
                <div className="chip-suscripcion chip-suscripcion-pausada">{clubesPausados} pausados</div>
                <div className="chip-suscripcion chip-suscripcion-cancelada">{clubesCancelados} cancelados</div>
            </div>

        </div>
    );
}

export default AdminResumen;
