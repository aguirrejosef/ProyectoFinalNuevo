import React, { useEffect, useMemo, useState } from 'react';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import Toast from '../Toast/Toast';
import './BalanceAdmin.css';
import { apiFetch } from '../../api';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatearPeriodo = (periodo) => {
    const [anio, mes] = periodo.split('-');
    return `${MESES[Number(mes) - 1]} ${anio}`;
};

const formatearMoneda = (monto) => `$${Math.round(monto).toLocaleString('es-AR')}`;

const POR_PAGINA = 10;

function BalanceAdmin() {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [direccionOrden, setDireccionOrden] = useState('desc');
    const [pagina, setPagina] = useState(1);
    const [generandoExcel, setGenerandoExcel] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        const cargar = async () => {
            try {
                const res = await apiFetch('/admin/balance-mensual');
                if (!res.ok) throw new Error('Error al cargar el balance');
                const data = await res.json();
                setDatos(data);
            } catch (err) {
                console.error('Error al cargar el balance:', err);
                setError('No se pudo cargar el balance.');
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, []);

    useEffect(() => {
        setPagina(1);
    }, [busqueda]);

    const mesesFiltrados = useMemo(() => {
        if (!datos) return [];
        const texto = busqueda.trim().toLowerCase();
        const filtrados = texto
            ? datos.meses.filter((m) => formatearPeriodo(m.periodo).toLowerCase().includes(texto))
            : datos.meses;
        const ordenados = [...filtrados].sort((a, b) =>
            direccionOrden === 'asc' ? a.periodo.localeCompare(b.periodo) : b.periodo.localeCompare(a.periodo)
        );
        return ordenados;
    }, [datos, busqueda, direccionOrden]);

    const totalPaginas = Math.max(1, Math.ceil(mesesFiltrados.length / POR_PAGINA));
    const mesesPagina = mesesFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

    const handleOrdenarMes = () => {
        setDireccionOrden((actual) => (actual === 'asc' ? 'desc' : 'asc'));
    };

    const handleDescargarExcel = async () => {
        setGenerandoExcel(true);
        try {
            const res = await apiFetch('/admin/balance-mensual/excel');
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setToast({ tipo: 'error', mensaje: data.message || 'No se pudo generar el Excel' });
                return;
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const enlace = document.createElement('a');
            enlace.href = url;
            enlace.download = 'balance-suscripciones.xlsx';
            document.body.appendChild(enlace);
            enlace.click();
            enlace.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error al generar el Excel:', err);
            setToast({ tipo: 'error', mensaje: 'Error al conectar con el servidor' });
        } finally {
            setGenerandoExcel(false);
        }
    };

    return (
        <div>
            <NavBar />
            <div className="contenedor-balance">
                <div className="encabezado-balance">
                    <h1 className="titulo-tabla-admin">Balance de Suscripciones</h1>
                    {!cargando && !error && datos && datos.meses.length > 0 && (
                        <button type="button" className="btn-descargar-excel-balance" onClick={handleDescargarExcel} disabled={generandoExcel}>
                            {generandoExcel ? 'Generando...' : 'Descargar Excel'}
                        </button>
                    )}
                </div>

                {cargando && <p className="mensaje-balance">Cargando balance...</p>}
                {error && <p className="mensaje-balance">{error}</p>}

                {!cargando && !error && datos && (
                    <>
                        <div className="grid-tarjetas-balance">
                            <div className="tarjeta-balance tarjeta-balance-destacada">
                                <span className="tarjeta-balance-valor">{formatearMoneda(datos.total_historico)}</span>
                                <span className="tarjeta-balance-label">Ingreso histórico acumulado</span>
                            </div>
                            <div className="tarjeta-balance">
                                <span className="tarjeta-balance-valor">{formatearMoneda(datos.promedio_mensual)}</span>
                                <span className="tarjeta-balance-label">Promedio mensual</span>
                            </div>
                            <div className="tarjeta-balance">
                                <span className="tarjeta-balance-valor">{datos.meses.length}</span>
                                <span className="tarjeta-balance-label">Meses con cobros registrados</span>
                            </div>
                        </div>

                        {datos.meses.length === 0 ? (
                            <p className="mensaje-balance">Todavía no hay cobros de planes registrados.</p>
                        ) : (
                            <>
                                <div className="controles-lista-admin">
                                    <input
                                        type="text"
                                        className="buscador-lista-admin"
                                        placeholder="Buscar por mes (ej: octubre, 2026)..."
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                    />
                                </div>

                                {mesesFiltrados.length === 0 ? (
                                    <p className="mensaje-balance">No se encontraron meses para esa búsqueda.</p>
                                ) : (
                                    <>
                                        <div className="tabla-balance-wrap">
                                            <table className="tabla-balance">
                                                <thead>
                                                    <tr>
                                                        <th className="th-ordenable" onClick={handleOrdenarMes}>
                                                            Mes <span className="th-arrow th-arrow-activa">{direccionOrden === 'asc' ? '▴' : '▾'}</span>
                                                        </th>
                                                        <th className="centrado">Clubes que pagaron</th>
                                                        <th className="centrado">Cantidad de cobros</th>
                                                        <th>Total ingresado</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {mesesPagina.map((m) => (
                                                        <tr key={m.periodo}>
                                                            <td><strong>{formatearPeriodo(m.periodo)}</strong></td>
                                                            <td className="centrado">{m.cantidad_clubes}</td>
                                                            <td className="centrado">{m.cantidad_pagos}</td>
                                                            <td>{formatearMoneda(m.total)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {totalPaginas > 1 && (
                                            <div className="paginado-lista-admin">
                                                <button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                                                    ‹ Anterior
                                                </button>
                                                <span>Página {pagina} de {totalPaginas} ({mesesFiltrados.length} meses)</span>
                                                <button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                                                    Siguiente ›
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
            <Footer />
            <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
        </div>
    );
}

export default BalanceAdmin;
