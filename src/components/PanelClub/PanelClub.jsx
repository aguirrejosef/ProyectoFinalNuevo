import React, { useState, useEffect, useCallback } from 'react';
import './PanelClub.css';
import '../Modal/ModalConfirmacion.css';
import { apiFetch } from '../../api';
import CalendarioTurnos from './CalendarioTurnos';
import Toast from '../Toast/Toast';

const LIMITE_TURNOS_PERIODO = 10;
const DIAS_AVISO_VENCIMIENTO = 5;

function PanelClub() {
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [error, setError] = useState('');
  const [turnoACancelar, setTurnoACancelar] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [marcandoRestoId, setMarcandoRestoId] = useState(null);
  const [periodoResumen, setPeriodoResumen] = useState('mes');
  const [generandoExcel, setGenerandoExcel] = useState(false);

  // Listado de turnos: por defecto TODOS (pasados, de hoy y futuros), y se
  // puede filtrar a "hoy"/"esta semana" clickeando las tarjetas de arriba.
  const [filtroTurnos, setFiltroTurnos] = useState('todos');
  const [busquedaTurnosInput, setBusquedaTurnosInput] = useState('');
  const [busquedaTurnos, setBusquedaTurnos] = useState('');
  const [paginaTurnos, setPaginaTurnos] = useState(1);
  const [totalPaginasTurnos, setTotalPaginasTurnos] = useState(1);
  const [totalTurnosListado, setTotalTurnosListado] = useState(0);
  const [turnosListado, setTurnosListado] = useState([]);
  const [cargandoTurnosListado, setCargandoTurnosListado] = useState(true);
  const [errorTurnosListado, setErrorTurnosListado] = useState('');
  const [ordenTurnos, setOrdenTurnos] = useState('desc');
  const [vistaTurnos, setVistaTurnos] = useState('lista');
  const [refrescarCalendario, setRefrescarCalendario] = useState(0);
  const [toast, setToast] = useState(null);

  const nombreUsuario = localStorage.getItem('nombre');

  const fetchResumen = async () => {
    try {
      const res = await apiFetch('/club/resumen');
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'No se pudo cargar el resumen del club');
        return;
      }

      setResumen(data);
      setError('');
    } catch (error) {
      console.error('Error al cargar el resumen del club:', error);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarTurnosListado = useCallback(async () => {
    setCargandoTurnosListado(true);
    setErrorTurnosListado('');
    try {
      const params = new URLSearchParams({
        periodo: filtroTurnos,
        pagina: String(paginaTurnos),
        limite: String(LIMITE_TURNOS_PERIODO),
        orden: ordenTurnos
      });
      if (busquedaTurnos) params.set('busqueda', busquedaTurnos);

      const res = await apiFetch(`/club/turnos-periodo?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setTurnosListado([]);
        setErrorTurnosListado(data.message || 'No se pudo cargar la lista de turnos.');
        return;
      }

      setTurnosListado(Array.isArray(data.turnos) ? data.turnos : []);
      setTotalTurnosListado(data.total || 0);
      setTotalPaginasTurnos(data.totalPaginas || 1);

    } catch (err) {
      console.error('Error al cargar los turnos:', err);
      setTurnosListado([]);
      setErrorTurnosListado('No se pudo cargar la lista de turnos. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setCargandoTurnosListado(false);
    }
  }, [filtroTurnos, busquedaTurnos, paginaTurnos, ordenTurnos]);

  useEffect(() => {
    cargarTurnosListado();
  }, [cargarTurnosListado]);

  // Buscador con debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaTurnos(busquedaTurnosInput.trim());
      setPaginaTurnos(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [busquedaTurnosInput]);

  const handleCambiarFiltroTurnos = (valor) => {
    setFiltroTurnos(valor);
    setPaginaTurnos(1);
    // El filtro solo se ve reflejado en la vista Lista, así que si estaba en
    // Calendario lo pasamos a Lista — si no, tocar "Turnos hoy"/"esta semana"
    // desde el calendario no hacía nada visible.
    setVistaTurnos('lista');
  };

  const handleCambiarOrdenTurnos = () => {
    setOrdenTurnos((actual) => (actual === 'desc' ? 'asc' : 'desc'));
    setPaginaTurnos(1);
  };

  const formatearHora = (hora) => (hora ? hora.slice(0, 5) : '');

  const formatearFechaCorta = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatearPrecio = (monto) => `$${Number(monto || 0).toLocaleString('es-AR')}`;

  const handleAbrirCancelar = (turno) => {
    setTurnoACancelar(turno);
    setMotivoCancelacion('');
  };

  const handleCerrarCancelar = () => {
    setTurnoACancelar(null);
    setMotivoCancelacion('');
  };

  const handleConfirmarCancelacion = async () => {
    if (!turnoACancelar || !motivoCancelacion.trim()) return;

    setCancelandoId(turnoACancelar.id_turno);
    try {
      const res = await apiFetch(`/turnos/${turnoACancelar.id_turno}/cancelar`, {
        method: 'PUT',
        body: JSON.stringify({ motivo: motivoCancelacion.trim() })
      });

      if (!res.ok) throw new Error('Error al cancelar el turno');

      handleCerrarCancelar();
      // Volvemos a pedir el resumen y el listado para que los contadores y
      // la lista se actualicen solos
      await Promise.all([fetchResumen(), cargarTurnosListado()]);
      setRefrescarCalendario((n) => n + 1);
      setToast({ tipo: 'exito', mensaje: 'Turno cancelado correctamente.' });

    } catch (error) {
      console.error('Error al cancelar turno:', error);
      setToast({ tipo: 'error', mensaje: 'No se pudo cancelar el turno. Intentá de nuevo.' });
    } finally {
      setCancelandoId(null);
    }
  };

  const handleMarcarRestoCobrado = async (turno) => {
    setMarcandoRestoId(turno.id_turno);
    try {
      const res = await apiFetch(`/turnos/${turno.id_turno}/marcar-resto-pagado`, {
        method: 'PUT'
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ tipo: 'error', mensaje: data.message || 'No se pudo marcar el resto como cobrado' });
        return;
      }

      await Promise.all([fetchResumen(), cargarTurnosListado()]);
      setRefrescarCalendario((n) => n + 1);
      setToast({ tipo: 'exito', mensaje: 'Resto marcado como cobrado.' });

    } catch (error) {
      console.error('Error al marcar el resto como cobrado:', error);
      setToast({ tipo: 'error', mensaje: 'Error al conectar con el servidor' });
    } finally {
      setMarcandoRestoId(null);
    }
  };

  const NOMBRES_ESTADO_ITEM = {
    reservado: 'Reservado',
    completado: 'Completado',
    cancelado: 'Cancelado',
    pendiente_pago: 'Pendiente de pago'
  };

  const ETIQUETA_SUSCRIPCION = {
    activa: { texto: 'Suscripción al día', clase: 'badge-suscripcion-activa' },
    pausada: { texto: 'Suscripción pausada', clase: 'badge-suscripcion-pausada' },
    cancelada: { texto: 'Suscripción cancelada', clase: 'badge-suscripcion-cancelada' }
  };

  const handleDescargarExcel = async () => {
    setGenerandoExcel(true);
    try {
      const res = await apiFetch(`/club/resumen-descargable/excel?periodo=${periodoResumen}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast({ tipo: 'error', mensaje: data.message || 'No se pudo generar el Excel' });
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `resumen-${resumen.nombre_club.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error al generar el Excel:', error);
      setToast({ tipo: 'error', mensaje: 'Error al conectar con el servidor' });
    } finally {
      setGenerandoExcel(false);
    }
  };

  if (loading) {
    return <div className="panel-club-cargando">Cargando panel...</div>;
  }

  if (error || !resumen) {
    return <div className="panel-club-cargando">{error || 'No se pudo cargar la información del club.'}</div>;
  }

  // Si la suscripción está al día pero vence pronto, avisamos antes de que
  // se corte: el bloqueo por falta de pago recién se aplica el día después
  // del vencimiento, así que esto le da unos días de margen para pagar.
  let diasParaVencimiento = null;
  if (resumen.proxima_fecha_pago) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const vencimiento = new Date(resumen.proxima_fecha_pago);
    vencimiento.setHours(0, 0, 0, 0);
    diasParaVencimiento = Math.round((vencimiento - hoy) / (1000 * 60 * 60 * 24));
  }
  const proximoAVencer = resumen.estado_suscripcion === 'activa'
    && diasParaVencimiento !== null && diasParaVencimiento >= 0 && diasParaVencimiento <= DIAS_AVISO_VENCIMIENTO;

  const textoAvisoVencimiento = diasParaVencimiento === 0
    ? 'Tu plan vence hoy'
    : diasParaVencimiento === 1
      ? 'Tu plan vence mañana'
      : `Tu plan vence en ${diasParaVencimiento} días`;

  return (
    <div className="panel-club-contenedor">

      <div className="panel-club-header">
        <div>
          <h1>Hola{nombreUsuario ? `, ${nombreUsuario}` : ''} 👋</h1>
          <p>Este es el resumen de <strong>{resumen.nombre_club}</strong></p>
        </div>
        <div className="panel-club-header-badges">
          {resumen.plan && <span className="panel-club-badge-plan">Plan {resumen.plan}</span>}
          {ETIQUETA_SUSCRIPCION[resumen.estado_suscripcion] && (
            <span className={`panel-club-badge-suscripcion ${proximoAVencer ? 'badge-suscripcion-por-vencer' : ETIQUETA_SUSCRIPCION[resumen.estado_suscripcion].clase}`}>
              {proximoAVencer ? textoAvisoVencimiento : ETIQUETA_SUSCRIPCION[resumen.estado_suscripcion].texto}
              {resumen.proxima_fecha_pago && ` · próximo pago ${formatearFechaCorta(resumen.proxima_fecha_pago)}`}
            </span>
          )}
        </div>
      </div>

      <div className="panel-club-kpis">
        <div className="kpi-card">
          <span className="kpi-icono">🎾</span>
          <div className="kpi-textos">
            <strong>{resumen.canchas_activas}/{resumen.total_canchas}</strong>
            <span>Canchas activas</span>
          </div>
        </div>

        <div
          className={`kpi-card kpi-card-clickeable ${filtroTurnos === 'hoy' ? 'kpi-card-activa' : ''}`}
          onClick={() => handleCambiarFiltroTurnos('hoy')}
        >
          <span className="kpi-icono">📅</span>
          <div className="kpi-textos">
            <strong>{resumen.turnos_hoy}</strong>
            <span>Turnos hoy</span>
          </div>
        </div>

        <div
          className={`kpi-card kpi-card-clickeable ${filtroTurnos === 'semana' ? 'kpi-card-activa' : ''}`}
          onClick={() => handleCambiarFiltroTurnos('semana')}
        >
          <span className="kpi-icono">📈</span>
          <div className="kpi-textos">
            <strong>{resumen.turnos_semana}</strong>
            <span>Turnos esta semana</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icono">👥</span>
          <div className="kpi-textos">
            <strong>{resumen.total_clientes}</strong>
            <span>Clientes totales</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-destacada">
          <span className="kpi-icono">💰</span>
          <div className="kpi-textos">
            <strong>{formatearPrecio(resumen.ingresos_mes)}</strong>
            <span>Ingresos este mes</span>
          </div>
        </div>
      </div>

      <div className="panel-club-resumen-descargable no-imprimir">
        <div className="panel-club-resumen-descargable-texto">
          <h2>Resumen descargable</h2>
          <p>Turnos, clientes e ingresos reales del club, listos para descargar en Excel.</p>
        </div>
        <div className="panel-club-resumen-descargable-acciones">
          <select
            value={periodoResumen}
            onChange={(e) => setPeriodoResumen(e.target.value)}
            className="select-periodo-resumen"
          >
            <option value="mes">Este mes</option>
            <option value="anio">Este año</option>
            <option value="todo">Todo</option>
          </select>
          <button
            type="button"
            className="btn-descargar-resumen btn-descargar-excel"
            onClick={handleDescargarExcel}
            disabled={generandoExcel}
          >
            {generandoExcel ? 'Generando...' : 'Descargar Excel'}
          </button>
        </div>
      </div>

      <div className="panel-club-turnos-hoy">
        <div className="panel-club-turnos-header">
          <h2>Turnos</h2>
          <div className="panel-club-turnos-header-acciones">
            <div className="toggle-vista-turnos">
              <button
                type="button"
                className={vistaTurnos === 'lista' ? 'activo' : ''}
                onClick={() => setVistaTurnos('lista')}
              >
                Lista
              </button>
              <button
                type="button"
                className={vistaTurnos === 'calendario' ? 'activo' : ''}
                onClick={() => setVistaTurnos('calendario')}
              >
                Calendario
              </button>
            </div>
            {vistaTurnos === 'lista' && filtroTurnos !== 'todos' && (
              <button type="button" className="btn-ver-todos-turnos" onClick={() => handleCambiarFiltroTurnos('todos')}>
                Ver todos
              </button>
            )}
            {vistaTurnos === 'lista' && (
              <button type="button" className="btn-orden-turnos" onClick={handleCambiarOrdenTurnos} title="Cambiar orden por fecha">
                Fecha {ordenTurnos === 'desc' ? '↓' : '↑'}
              </button>
            )}
            {vistaTurnos === 'lista' && (
              <input
                type="text"
                className="buscador-turnos-periodo"
                placeholder="Buscar por cliente o cancha..."
                value={busquedaTurnosInput}
                onChange={(e) => setBusquedaTurnosInput(e.target.value)}
              />
            )}
          </div>
        </div>

        {vistaTurnos === 'calendario' ? (
          <CalendarioTurnos
            formatearHora={formatearHora}
            nombresEstadoItem={NOMBRES_ESTADO_ITEM}
            cancelandoId={cancelandoId}
            marcandoRestoId={marcandoRestoId}
            onAbrirCancelar={handleAbrirCancelar}
            onMarcarRestoCobrado={handleMarcarRestoCobrado}
            refrescar={refrescarCalendario}
          />
        ) : (
          <>
            {cargandoTurnosListado && <p className="panel-club-vacio">Cargando...</p>}

            {!cargandoTurnosListado && errorTurnosListado && (
              <p className="panel-club-vacio panel-club-error">{errorTurnosListado}</p>
            )}

            {!cargandoTurnosListado && !errorTurnosListado && turnosListado.length === 0 && (
              <p className="panel-club-vacio">
                {filtroTurnos === 'hoy' && 'No tenés turnos reservados para hoy.'}
                {filtroTurnos === 'semana' && 'No tenés turnos reservados esta semana.'}
                {filtroTurnos === 'todos' && 'Todavía no tenés turnos registrados.'}
              </p>
            )}

            {!cargandoTurnosListado && turnosListado.length > 0 && (
              <div className="lista-turnos-hoy">
                {turnosListado.map((t) => (
                  <div key={t.id_turno} className="item-turno-hoy">
                    {filtroTurnos !== 'hoy' && (
                      <span className="item-turno-fecha">
                        {new Date(t.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                    <span className="item-turno-hora">
                      {formatearHora(t.hora_inicio)} - {formatearHora(t.hora_fin)}
                    </span>
                    <span className="item-turno-cliente">
                      {t.nombre ? `${t.nombre} ${t.apellido || ''}` : t.usuario}
                    </span>
                    {t.telefono && (
                      <a className="item-turno-telefono" href={`tel:${t.telefono}`} onClick={(e) => e.stopPropagation()}>
                        📞 {t.telefono}
                      </a>
                    )}
                    <span className="item-turno-cancha">{t.cancha}</span>
                    {filtroTurnos === 'todos' && (
                      <span className={`item-turno-estado-badge estado-badge-${t.estado}`}>
                        {NOMBRES_ESTADO_ITEM[t.estado] || t.estado}
                      </span>
                    )}
                    {t.monto_sena && t.estado !== 'cancelado' && (
                      t.resto_pagado_en ? (
                        <span className="item-turno-resto-cobrado">✓ Resto cobrado</span>
                      ) : (
                        <button
                          className="btn-marcar-resto-cobrado"
                          onClick={() => handleMarcarRestoCobrado(t)}
                          disabled={marcandoRestoId === t.id_turno}
                        >
                          {marcandoRestoId === t.id_turno ? 'Guardando...' : 'Marcar resto cobrado'}
                        </button>
                      )
                    )}
                    {t.estado === 'reservado' && (
                      <button
                        className="btn-cancelar-turno-hoy"
                        onClick={() => handleAbrirCancelar(t)}
                        disabled={cancelandoId === t.id_turno}
                      >
                        {cancelandoId === t.id_turno ? 'Cancelando...' : 'Cancelar'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!cargandoTurnosListado && totalPaginasTurnos > 1 && (
              <div className="paginado-turnos-periodo">
                <button type="button" disabled={paginaTurnos <= 1} onClick={() => setPaginaTurnos((p) => p - 1)}>‹ Anterior</button>
                <span>Página {paginaTurnos} de {totalPaginasTurnos} ({totalTurnosListado})</span>
                <button type="button" disabled={paginaTurnos >= totalPaginasTurnos} onClick={() => setPaginaTurnos((p) => p + 1)}>Siguiente ›</button>
              </div>
            )}
          </>
        )}
      </div>

      {turnoACancelar && (
        <div className="overlay-modal-cancelar" onClick={handleCerrarCancelar}>
          <div className="modal-cancelar-turno" onClick={(e) => e.stopPropagation()}>
            <h3>Cancelar turno</h3>
            <p>
              {turnoACancelar.nombre ? `${turnoACancelar.nombre} ${turnoACancelar.apellido || ''}` : turnoACancelar.usuario}
              {' '}— {formatearHora(turnoACancelar.hora_inicio)} a {formatearHora(turnoACancelar.hora_fin)}hs en {turnoACancelar.cancha}
            </p>

            <label className="label-motivo-cancelacion">
              Motivo de la cancelación (se le va a enviar por correo al cliente)
              <textarea
                value={motivoCancelacion}
                onChange={(e) => setMotivoCancelacion(e.target.value)}
                placeholder="Ej: se suspendió por lluvia, problema con la cancha, etc."
                rows={4}
              />
            </label>

            <div className="botones-modal-cancelar">
              <button type="button" className="btn-volver-modal-cancelar" onClick={handleCerrarCancelar}>
                Volver
              </button>
              <button
                type="button"
                className="btn-confirmar-modal-cancelar"
                onClick={handleConfirmarCancelacion}
                disabled={!motivoCancelacion.trim() || cancelandoId === turnoACancelar.id_turno}
              >
                {cancelandoId === turnoACancelar.id_turno ? 'Cancelando...' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
    </div>
  );
}

export default PanelClub;