import React, { useState, useEffect } from 'react';
import './PanelClub.css';
import { apiFetch } from '../../api';

function PanelClub() {
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelandoId, setCancelandoId] = useState(null);

  const nombreUsuario = localStorage.getItem('nombre');

  const fetchResumen = async () => {
    try {
      const res = await apiFetch('/club/resumen');
      const data = await res.json();
      setResumen(data);
    } catch (error) {
      console.error('Error al cargar el resumen del club:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatearHora = (hora) => (hora ? hora.slice(0, 5) : '');

  const handleCancelarTurno = async (turno) => {
    const nombreCliente = turno.nombre ? `${turno.nombre} ${turno.apellido || ''}` : turno.usuario;
    const confirmar = window.confirm(
      `¿Cancelar el turno de ${nombreCliente} a las ${formatearHora(turno.hora_inicio)}hs?`
    );
    if (!confirmar) return;

    setCancelandoId(turno.id_turno);
    try {
      const res = await apiFetch(`/turnos/${turno.id_turno}/cancelar`, {
        method: 'PUT'
      });

      if (!res.ok) throw new Error('Error al cancelar el turno');

      // Volvemos a pedir el resumen para que los contadores y la lista se actualicen solos
      await fetchResumen();

    } catch (error) {
      console.error('Error al cancelar turno:', error);
      alert('No se pudo cancelar el turno. Intentá de nuevo.');
    } finally {
      setCancelandoId(null);
    }
  };

  if (loading) {
    return <div className="panel-club-cargando">Cargando panel...</div>;
  }

  if (!resumen) {
    return <div className="panel-club-cargando">No se pudo cargar la información del club.</div>;
  }

  return (
    <div className="panel-club-contenedor">

      <div className="panel-club-header">
        <div>
          <h1>Hola{nombreUsuario ? `, ${nombreUsuario}` : ''} 👋</h1>
          <p>Este es el resumen de <strong>{resumen.nombre_club}</strong></p>
        </div>
        {resumen.plan && <span className="panel-club-badge-plan">Plan {resumen.plan}</span>}
      </div>

      <div className="panel-club-kpis">
        <div className="kpi-card">
          <span className="kpi-icono">🎾</span>
          <div className="kpi-textos">
            <strong>{resumen.canchas_activas}/{resumen.total_canchas}</strong>
            <span>Canchas activas</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-icono">📅</span>
          <div className="kpi-textos">
            <strong>{resumen.turnos_hoy}</strong>
            <span>Turnos hoy</span>
          </div>
        </div>

        <div className="kpi-card">
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
      </div>

      <div className="panel-club-turnos-hoy">
        <h2>Turnos de hoy</h2>

        {resumen.proximos_turnos_hoy.length === 0 && (
          <p className="panel-club-vacio">No tenés turnos reservados para hoy.</p>
        )}

        {resumen.proximos_turnos_hoy.length > 0 && (
          <div className="lista-turnos-hoy">
            {resumen.proximos_turnos_hoy.map((t) => (
              <div key={t.id_turno} className="item-turno-hoy">
                <span className="item-turno-hora">
                  {formatearHora(t.hora_inicio)} - {formatearHora(t.hora_fin)}
                </span>
                <span className="item-turno-cliente">
                  {t.nombre ? `${t.nombre} ${t.apellido || ''}` : t.usuario}
                </span>
                <span className="item-turno-cancha">{t.cancha}</span>
                <button
                  className="btn-cancelar-turno-hoy"
                  onClick={() => handleCancelarTurno(t)}
                  disabled={cancelandoId === t.id_turno}
                >
                  {cancelandoId === t.id_turno ? 'Cancelando...' : 'Cancelar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default PanelClub;