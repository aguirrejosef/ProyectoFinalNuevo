import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api';
import './AdminResumen.css';

const PRECIOS_PLANES = { basico: 50000, estandar: 80000, premium: 120000 };

const formatearMoneda = (monto) => `$${Math.round(monto).toLocaleString('es-AR')}`;

function AdminResumen() {
    const [clubes, setClubes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const cargar = async () => {
            try {
                const [resClubes, resUsuarios] = await Promise.all([
                    apiFetch('/admin/clubes'),
                    apiFetch('/usuarios')
                ]);
                const dataClubes = await resClubes.json();
                const dataUsuarios = await resUsuarios.json();
                setClubes(Array.isArray(dataClubes) ? dataClubes : []);
                setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : []);
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

    const totalClientes = usuarios.filter((u) => u.id_rol === 3).length;
    const totalDuenosClub = usuarios.filter((u) => u.id_rol === 2).length;
    const totalAdmins = usuarios.filter((u) => u.id_rol === 1).length;

    const clubesActivos = clubes.filter((c) => c.estado_suscripcion === 'activa').length;
    const clubesPausados = clubes.filter((c) => c.estado_suscripcion === 'pausada').length;
    const clubesCancelados = clubes.filter((c) => c.estado_suscripcion === 'cancelada').length;

    const mrrEstimado = clubes
        .filter((c) => c.estado_suscripcion === 'activa' && PRECIOS_PLANES[c.plan])
        .reduce((total, c) => total + PRECIOS_PLANES[c.plan], 0);

    const proximosVencimientos = clubes
        .filter((c) => c.proxima_fecha_pago)
        .sort((a, b) => new Date(a.proxima_fecha_pago) - new Date(b.proxima_fecha_pago))
        .slice(0, 5);

    return (
        <div className="resumen-admin">
            <div className="grid-tarjetas-resumen">
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{clubes.length}</span>
                    <span className="tarjeta-resumen-label">Clubes registrados</span>
                </div>
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{totalClientes}</span>
                    <span className="tarjeta-resumen-label">Clientes</span>
                </div>
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{totalDuenosClub}</span>
                    <span className="tarjeta-resumen-label">Dueños de club</span>
                </div>
                <div className="tarjeta-resumen">
                    <span className="tarjeta-resumen-valor">{totalAdmins}</span>
                    <span className="tarjeta-resumen-label">Administradores</span>
                </div>
                <div className="tarjeta-resumen tarjeta-resumen-destacada">
                    <span className="tarjeta-resumen-valor">{formatearMoneda(mrrEstimado)}</span>
                    <span className="tarjeta-resumen-label">Ingreso mensual estimado</span>
                </div>
            </div>

            <div className="fila-suscripciones-resumen">
                <div className="chip-suscripcion chip-suscripcion-activa">{clubesActivos} al día</div>
                <div className="chip-suscripcion chip-suscripcion-pausada">{clubesPausados} pausados</div>
                <div className="chip-suscripcion chip-suscripcion-cancelada">{clubesCancelados} cancelados</div>
            </div>

            {proximosVencimientos.length > 0 && (
                <div className="proximos-vencimientos">
                    <h3>Próximos vencimientos</h3>
                    <ul>
                        {proximosVencimientos.map((c) => (
                            <li key={c.id_club}>
                                <span>{c.nombre}</span>
                                <span>{new Date(c.proxima_fecha_pago).toLocaleDateString('es-AR')}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export default AdminResumen;
