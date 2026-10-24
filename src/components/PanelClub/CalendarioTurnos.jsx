import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../../api';
import './CalendarioTurnos.css';

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const NOMBRES_MES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function aFechaStr(anio, mes, dia) {
    return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function CalendarioTurnos({
    formatearHora,
    nombresEstadoItem,
    cancelandoId,
    marcandoRestoId,
    onAbrirCancelar,
    onMarcarRestoCobrado,
    refrescar
}) {
    const hoy = new Date();
    const [anio, setAnio] = useState(hoy.getFullYear());
    const [mes, setMes] = useState(hoy.getMonth() + 1); // 1-12

    const [diasConTurnos, setDiasConTurnos] = useState({});
    const [cargandoMes, setCargandoMes] = useState(true);
    const [errorMes, setErrorMes] = useState('');

    const [diaSeleccionado, setDiaSeleccionado] = useState(aFechaStr(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()));
    const [turnosDia, setTurnosDia] = useState([]);
    const [cargandoDia, setCargandoDia] = useState(true);
    const [errorDia, setErrorDia] = useState('');

    const cargarMes = useCallback(async () => {
        setCargandoMes(true);
        setErrorMes('');
        try {
            const res = await apiFetch(`/club/turnos-calendario?anio=${anio}&mes=${mes}`);
            const data = await res.json();
            if (!res.ok) {
                setDiasConTurnos({});
                setErrorMes(data.message || 'No se pudo cargar el calendario.');
                return;
            }
            setDiasConTurnos(data.dias || {});
        } catch (error) {
            console.error('Error al cargar el calendario:', error);
            setDiasConTurnos({});
            setErrorMes('No se pudo cargar el calendario. Revisá tu conexión.');
        } finally {
            setCargandoMes(false);
        }
    }, [anio, mes]);

    useEffect(() => {
        cargarMes();
    }, [cargarMes, refrescar]);

    const cargarDia = useCallback(async () => {
        if (!diaSeleccionado) return;
        setCargandoDia(true);
        setErrorDia('');
        try {
            const res = await apiFetch(`/club/turnos-periodo?fecha=${diaSeleccionado}&limite=50`);
            const data = await res.json();
            if (!res.ok) {
                setTurnosDia([]);
                setErrorDia(data.message || 'No se pudieron cargar los turnos de este día.');
                return;
            }
            setTurnosDia(Array.isArray(data.turnos) ? data.turnos : []);
        } catch (error) {
            console.error('Error al cargar los turnos del día:', error);
            setTurnosDia([]);
            setErrorDia('No se pudieron cargar los turnos de este día. Revisá tu conexión.');
        } finally {
            setCargandoDia(false);
        }
    }, [diaSeleccionado]);

    useEffect(() => {
        cargarDia();
    }, [cargarDia, refrescar]);

    const handleMesAnterior = () => {
        if (mes === 1) { setMes(12); setAnio((a) => a - 1); } else { setMes((m) => m - 1); }
    };

    const handleMesSiguiente = () => {
        if (mes === 12) { setMes(1); setAnio((a) => a + 1); } else { setMes((m) => m + 1); }
    };

    // Arma la grilla del mes: lunes a domingo, con relleno de celdas vacías
    const primerDiaSemana = (new Date(anio, mes - 1, 1).getDay() + 6) % 7; // 0 = lunes
    const diasEnMes = new Date(anio, mes, 0).getDate();
    const celdas = [];
    for (let i = 0; i < primerDiaSemana; i++) celdas.push(null);
    for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

    const esHoy = (d) => aFechaStr(anio, mes, d) === aFechaStr(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate());
    const esSeleccionado = (d) => aFechaStr(anio, mes, d) === diaSeleccionado;

    return (
        <div className="calendario-turnos">
            <div className="calendario-panel">
                <div className="calendario-header">
                    <button type="button" onClick={handleMesAnterior}>‹</button>
                    <strong>{NOMBRES_MES[mes - 1]} {anio}</strong>
                    <button type="button" onClick={handleMesSiguiente}>›</button>
                </div>

                {errorMes && <p className="panel-club-vacio panel-club-error">{errorMes}</p>}

                <div className="calendario-grilla-dias">
                    {DIAS_SEMANA.map((d) => <span key={d} className="calendario-dia-semana">{d}</span>)}

                    {celdas.map((d, i) => {
                        if (d === null) return <span key={`vacio-${i}`} className="calendario-celda-vacia"></span>;
                        const cantidad = diasConTurnos[aFechaStr(anio, mes, d)] || 0;
                        return (
                            <button
                                type="button"
                                key={d}
                                className={`calendario-celda-dia ${esHoy(d) ? 'calendario-dia-hoy' : ''} ${esSeleccionado(d) ? 'calendario-dia-seleccionado' : ''}`}
                                onClick={() => setDiaSeleccionado(aFechaStr(anio, mes, d))}
                            >
                                <span className="calendario-numero-dia">{d}</span>
                                {cantidad > 0 && <span className="calendario-punto-turnos">{cantidad}</span>}
                            </button>
                        );
                    })}
                </div>

                {cargandoMes && <p className="calendario-mensaje-sutil">Cargando mes...</p>}
            </div>

            <div className="calendario-dia-detalle">
                <h3>
                    {diaSeleccionado && new Date(`${diaSeleccionado}T00:00:00`).toLocaleDateString('es-AR', {
                        weekday: 'long', day: '2-digit', month: 'long'
                    })}
                </h3>

                {cargandoDia && <p className="panel-club-vacio">Cargando...</p>}

                {!cargandoDia && errorDia && (
                    <p className="panel-club-vacio panel-club-error">{errorDia}</p>
                )}

                {!cargandoDia && !errorDia && turnosDia.length === 0 && (
                    <p className="panel-club-vacio">No hay turnos este día.</p>
                )}

                {!cargandoDia && turnosDia.length > 0 && (
                    <div className="lista-turnos-hoy">
                        {turnosDia.map((t) => (
                            <div key={t.id_turno} className="item-turno-hoy">
                                <span className="item-turno-hora">
                                    {formatearHora(t.hora_inicio)} - {formatearHora(t.hora_fin)}
                                </span>
                                <span className="item-turno-cliente">
                                    {t.nombre ? `${t.nombre} ${t.apellido || ''}` : t.usuario}
                                </span>
                                {t.telefono && (
                                    <a className="item-turno-telefono" href={`tel:${t.telefono}`}>📞 {t.telefono}</a>
                                )}
                                <span className="item-turno-cancha">{t.cancha}</span>
                                <span className={`item-turno-estado-badge estado-badge-${t.estado}`}>
                                    {nombresEstadoItem[t.estado] || t.estado}
                                </span>
                                {t.monto_sena && t.estado !== 'cancelado' && (
                                    t.resto_pagado_en ? (
                                        <span className="item-turno-resto-cobrado">✓ Resto cobrado</span>
                                    ) : (
                                        <button
                                            className="btn-marcar-resto-cobrado"
                                            onClick={() => onMarcarRestoCobrado(t)}
                                            disabled={marcandoRestoId === t.id_turno}
                                        >
                                            {marcandoRestoId === t.id_turno ? 'Guardando...' : 'Marcar resto cobrado'}
                                        </button>
                                    )
                                )}
                                {t.estado === 'reservado' && (
                                    <button
                                        className="btn-cancelar-turno-hoy"
                                        onClick={() => onAbrirCancelar(t)}
                                        disabled={cancelandoId === t.id_turno}
                                    >
                                        {cancelandoId === t.id_turno ? 'Cancelando...' : 'Cancelar'}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default CalendarioTurnos;
