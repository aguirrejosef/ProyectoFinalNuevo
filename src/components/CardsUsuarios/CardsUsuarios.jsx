import React, { useState, useEffect, useCallback } from 'react';
import './CardsUsuarios.css';
import { apiFetch } from '../../api';

const UMBRAL_CLIENTE_FRECUENTE = 5;
const LIMITE_ADMIN = 12;
const LIMITE_CLUB = 12;

const Usuarios = () => {
  const rol = localStorage.getItem('rol');
  const miId = Number(localStorage.getItem('id'));
  const esClub = Number(rol) === 2;

  // ------------------ Vista CLUB: búsqueda, filtro, orden y paginado reales en el backend ------------------
  const [clientesClub, setClientesClub] = useState([]);
  const [cargandoClub, setCargandoClub] = useState(true);
  const [totalClub, setTotalClub] = useState(0);
  const [paginaClub, setPaginaClub] = useState(1);
  const [totalPaginasClub, setTotalPaginasClub] = useState(1);
  const [busquedaClubInput, setBusquedaClubInput] = useState('');
  const [busquedaClub, setBusquedaClub] = useState('');
  const [estadoFiltroClub, setEstadoFiltroClub] = useState('activo');
  const [campoOrdenClub, setCampoOrdenClub] = useState('total_turnos');
  const [direccionOrdenClub, setDireccionOrdenClub] = useState('desc');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [turnosCliente, setTurnosCliente] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  // ------------------ Vista ADMIN: búsqueda, filtro y paginado reales en el backend ------------------
  const [usuariosAdmin, setUsuariosAdmin] = useState([]);
  const [cargandoAdmin, setCargandoAdmin] = useState(true);
  const [totalAdmin, setTotalAdmin] = useState(0);
  const [paginaAdmin, setPaginaAdmin] = useState(1);
  const [totalPaginasAdmin, setTotalPaginasAdmin] = useState(1);
  const [busquedaAdminInput, setBusquedaAdminInput] = useState('');
  const [busquedaAdmin, setBusquedaAdmin] = useState('');
  const [estadoFiltroAdmin, setEstadoFiltroAdmin] = useState('activo');
  const [procesandoId, setProcesandoId] = useState(null);
  const [campoOrdenAdmin, setCampoOrdenAdmin] = useState('fecha_registro');
  const [direccionOrdenAdmin, setDireccionOrdenAdmin] = useState('desc');

  // Buscador del club con debounce
  useEffect(() => {
    if (!esClub) return;
    const timer = setTimeout(() => {
      setBusquedaClub(busquedaClubInput.trim());
      setPaginaClub(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [busquedaClubInput, esClub]);

  const cargarClientesClub = useCallback(async () => {
    if (!esClub) return;
    setCargandoClub(true);
    try {
      const params = new URLSearchParams({
        pagina: String(paginaClub),
        limite: String(LIMITE_CLUB),
        estado: estadoFiltroClub,
        campo: campoOrdenClub,
        direccion: direccionOrdenClub
      });
      if (busquedaClub) params.set('busqueda', busquedaClub);

      const res = await apiFetch(`/club/clientes-buscar?${params.toString()}`);
      const data = await res.json();
      setClientesClub(Array.isArray(data.clientes) ? data.clientes : []);
      setTotalClub(data.total || 0);
      setTotalPaginasClub(data.totalPaginas || 1);
    } catch (error) {
      console.error('Error al cargar clientes del club:', error);
    } finally {
      setCargandoClub(false);
    }
  }, [esClub, paginaClub, busquedaClub, estadoFiltroClub, campoOrdenClub, direccionOrdenClub]);

  useEffect(() => {
    cargarClientesClub();
  }, [cargarClientesClub]);

  // Buscador del admin con debounce
  useEffect(() => {
    if (esClub) return;
    const timer = setTimeout(() => {
      setBusquedaAdmin(busquedaAdminInput.trim());
      setPaginaAdmin(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [busquedaAdminInput, esClub]);

  const cargarUsuariosAdmin = useCallback(async () => {
    if (esClub) return;
    setCargandoAdmin(true);
    try {
      const params = new URLSearchParams({
        pagina: String(paginaAdmin),
        limite: String(LIMITE_ADMIN),
        rol: '3',
        estado: estadoFiltroAdmin,
        campo: campoOrdenAdmin,
        direccion: direccionOrdenAdmin
      });
      if (busquedaAdmin) params.set('busqueda', busquedaAdmin);

      const res = await apiFetch(`/usuarios/buscar?${params.toString()}`);
      const data = await res.json();
      setUsuariosAdmin(Array.isArray(data.usuarios) ? data.usuarios : []);
      setTotalAdmin(data.total || 0);
      setTotalPaginasAdmin(data.totalPaginas || 1);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setCargandoAdmin(false);
    }
  }, [esClub, paginaAdmin, busquedaAdmin, estadoFiltroAdmin, campoOrdenAdmin, direccionOrdenAdmin]);

  useEffect(() => {
    cargarUsuariosAdmin();
  }, [cargarUsuariosAdmin]);

  const formatearFecha = (fecha) => {
    if (!fecha) return null;
    return new Date(fecha).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatearHora = (hora) => {
    if (!hora) return '';
    return hora.slice(0, 5); // "18:00:00" -> "18:00"
  };

  const formatearMesAno = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR', {
      month: 'short',
      year: 'numeric'
    });
  };

  const iniciales = (usuario) => {
    if (usuario.nombre) return usuario.nombre.charAt(0).toUpperCase();
    if (usuario.usuario) return usuario.usuario.charAt(0).toUpperCase();
    return '?';
  };

  const claseEstado = (estado) => {
    const e = (estado || '').toLowerCase();
    if (e === 'reservado') return 'estado-badge estado-reservado';
    if (e === 'cancelado') return 'estado-badge estado-cancelado';
    if (e === 'completado') return 'estado-badge estado-completado';
    return 'estado-badge';
  };

  // ------------------ Abrir / cerrar detalle de cliente (vista club) ------------------
  const handleAbrirDetalle = async (user) => {
    setClienteSeleccionado(user);
    setCargandoTurnos(true);
    setTurnosCliente([]);

    try {
      const res = await apiFetch(
        `/club/turnos-cliente?id_usuario=${user.id_usuario}`
      );
      const data = await res.json();
      setTurnosCliente(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar turnos del cliente:', error);
    } finally {
      setCargandoTurnos(false);
    }
  };

  const handleCerrarDetalle = () => {
    setClienteSeleccionado(null);
    setTurnosCliente([]);
  };

  // ------------------ Dar de baja / reactivar usuario (solo admin) ------------------
  const handleCambiarEstadoUsuario = async (user) => {
    const nuevoActivo = user.activo === 0 ? 1 : 0;
    setProcesandoId(user.id_usuario);

    try {
      const res = await apiFetch(`/usuarios/${user.id_usuario}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activo: nuevoActivo })
      });

      if (res.ok) {
        setUsuariosAdmin((actuales) =>
          actuales.map((u) => (u.id_usuario === user.id_usuario ? { ...u, activo: nuevoActivo } : u))
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.message || 'No se pudo cambiar el estado del usuario');
      }
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error);
      alert('Ocurrió un error al conectar con el servidor');
    } finally {
      setProcesandoId(null);
    }
  };

  const handleFiltroEstadoAdmin = (valor) => {
    setEstadoFiltroAdmin(valor);
    setPaginaAdmin(1);
  };

  // El orden acá lo resuelve el backend (la tabla está paginada), no se
  // puede ordenar solo lo que ya se descargó como en la vista club.
  const handleOrdenarAdmin = (campo) => {
    if (campoOrdenAdmin === campo) {
      setDireccionOrdenAdmin(direccionOrdenAdmin === 'asc' ? 'desc' : 'asc');
    } else {
      setCampoOrdenAdmin(campo);
      setDireccionOrdenAdmin(campo === 'fecha_registro' ? 'desc' : 'asc');
    }
    setPaginaAdmin(1);
  };

  const flechaColumnaAdmin = (campo) => {
    if (campoOrdenAdmin !== campo) return <span className="th-arrow th-arrow-inactiva">▾</span>;
    return <span className="th-arrow th-arrow-activa">{direccionOrdenAdmin === 'asc' ? '▴' : '▾'}</span>;
  };

  const handleFiltroEstadoClub = (valor) => {
    setEstadoFiltroClub(valor);
    setPaginaClub(1);
  };

  // El orden acá lo resuelve el backend (la tabla está paginada).
  const handleOrdenarClub = (campo) => {
    if (campoOrdenClub === campo) {
      setDireccionOrdenClub(direccionOrdenClub === 'asc' ? 'desc' : 'asc');
    } else {
      setCampoOrdenClub(campo);
      setDireccionOrdenClub(campo === 'nombre' ? 'asc' : 'desc');
    }
    setPaginaClub(1);
  };

  const flechaColumnaClub = (campo) => {
    if (campoOrdenClub !== campo) return <span className="th-arrow th-arrow-inactiva">▾</span>;
    return <span className="th-arrow th-arrow-activa">{direccionOrdenClub === 'asc' ? '▴' : '▾'}</span>;
  };

  // ------------------ Vista CLUB: tabla de clientes con estadísticas ------------------
  if (esClub) {
    return (
      <div className="usuarios-contenedor">

        <h1 className="usuarios-titulo">Listado de Usuarios</h1>

        <div className="controles-lista-admin">
          <input
            type="text"
            className="buscador-lista-admin"
            placeholder="Buscar cliente por nombre, usuario o correo..."
            value={busquedaClubInput}
            onChange={(e) => setBusquedaClubInput(e.target.value)}
          />
          <select className="filtro-lista-admin" value={estadoFiltroClub} onChange={(e) => handleFiltroEstadoClub(e.target.value)}>
            <option value="activo">Activos</option>
            <option value="baja">Dados de baja</option>
          </select>
        </div>

        {cargandoClub && <p className="usuarios-vacio">Cargando...</p>}

        {!cargandoClub && clientesClub.length === 0 && (
          <p className="usuarios-vacio">
            {busquedaClub || estadoFiltroClub !== 'activo'
              ? 'No se encontró ningún cliente con esa búsqueda o filtro.'
              : 'Todavía no tenés clientes que hayan reservado en tu club.'}
          </p>
        )}

        {!cargandoClub && clientesClub.length > 0 && (
          <div className="tabla-usuarios-wrap">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th onClick={() => handleOrdenarClub('nombre')}>
                    Cliente {flechaColumnaClub('nombre')}
                  </th>
                  <th className="col-oculto-movil">Contacto</th>
                  <th className="col-oculto-movil" onClick={() => handleOrdenarClub('fecha_registro')}>
                    Cliente desde {flechaColumnaClub('fecha_registro')}
                  </th>
                  <th className="centrado" onClick={() => handleOrdenarClub('total_turnos')}>
                    Turnos {flechaColumnaClub('total_turnos')}
                  </th>
                  <th className="centrado" onClick={() => handleOrdenarClub('ultima_reserva')}>
                    Última reserva {flechaColumnaClub('ultima_reserva')}
                  </th>
                  <th className="centrado">Último turno</th>
                  <th className="centrado">Estado</th>
                </tr>
              </thead>
              <tbody>
                {clientesClub.map((user) => {
                  const clienteActivo = user.activo !== 0;
                  return (
                    <tr
                      key={user.id_usuario}
                      className={!clienteActivo ? 'fila-usuario-baja' : ''}
                      onClick={() => handleAbrirDetalle(user)}
                    >
                      <td>
                        <div className="col-cliente">
                          <div className="avatar-tabla">
                            {user.foto ? (
                              <img src={user.foto} alt={user.nombre || user.usuario} />
                            ) : (
                              <span>{iniciales(user)}</span>
                            )}
                          </div>
                          <div className="nombre-cliente">
                            <strong>
                              {user.nombre ? `${user.nombre} ${user.apellido || ''}` : user.usuario}
                              {user.total_turnos >= UMBRAL_CLIENTE_FRECUENTE && (
                                <span className="badge-frecuente">⭐ Frecuente</span>
                              )}
                            </strong>
                            <span>@{user.usuario}</span>
                          </div>
                        </div>
                      </td>

                      <td className="col-oculto-movil">
                        {user.correo && (
                          <a
                            className="contacto-linea"
                            href={`mailto:${user.correo}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            ✉️ {user.correo}
                          </a>
                        )}
                        {user.telefono && (
                          <a
                            className="contacto-linea"
                            href={`tel:${user.telefono}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            📞 {user.telefono}
                          </a>
                        )}
                      </td>

                      <td className="col-oculto-movil">{formatearMesAno(user.fecha_registro)}</td>

                      <td className="centrado">
                        <span className="turnos-num">{user.total_turnos}</span>
                      </td>

                      <td className="centrado">{formatearFecha(user.ultima_reserva) || '-'}</td>

                      <td className="centrado">
                        {user.ultimo_estado && (
                          <span className={claseEstado(user.ultimo_estado)}>{user.ultimo_estado}</span>
                        )}
                      </td>

                      <td className="centrado">
                        <span className={`badge-estado-usuario-tabla ${clienteActivo ? 'badge-estado-usuario-activo' : 'badge-estado-usuario-baja'}`}>
                          {clienteActivo ? 'Activo' : 'Dado de baja'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!cargandoClub && totalPaginasClub > 1 && (
          <div className="paginado-lista-admin">
            <button type="button" disabled={paginaClub <= 1} onClick={() => setPaginaClub((p) => p - 1)}>‹ Anterior</button>
            <span>Página {paginaClub} de {totalPaginasClub} ({totalClub} clientes)</span>
            <button type="button" disabled={paginaClub >= totalPaginasClub} onClick={() => setPaginaClub((p) => p + 1)}>Siguiente ›</button>
          </div>
        )}

        {/* ------------------ Modal detalle de cliente ------------------ */}
        {clienteSeleccionado && (
          <div className="detalle-overlay" onClick={handleCerrarDetalle}>
            <div className="detalle-panel" onClick={(e) => e.stopPropagation()}>

              <button type="button" className="detalle-cerrar" onClick={handleCerrarDetalle}>✕</button>

              <div className="detalle-header">
                <div className="avatar-tabla avatar-tabla-grande">
                  {clienteSeleccionado.foto ? (
                    <img src={clienteSeleccionado.foto} alt={clienteSeleccionado.nombre || clienteSeleccionado.usuario} />
                  ) : (
                    <span>{iniciales(clienteSeleccionado)}</span>
                  )}
                </div>
                <div>
                  <h3>
                    {clienteSeleccionado.nombre
                      ? `${clienteSeleccionado.nombre} ${clienteSeleccionado.apellido || ''}`
                      : clienteSeleccionado.usuario}
                  </h3>
                  <span className="cliente-usuario">@{clienteSeleccionado.usuario}</span>
                </div>
              </div>

              <h4 className="detalle-subtitulo">Historial de turnos en tu club</h4>

              {cargandoTurnos && <p className="detalle-vacio">Cargando turnos...</p>}

              {!cargandoTurnos && turnosCliente.length === 0 && (
                <p className="detalle-vacio">Este cliente todavía no tiene turnos registrados.</p>
              )}

              {!cargandoTurnos && turnosCliente.length > 0 && (
                <div className="detalle-lista">
                  {turnosCliente.map((t) => (
                    <div key={t.id_turno} className="detalle-item">
                      <div className="detalle-item-fecha">
                        <strong>{formatearFecha(t.fecha)}</strong>
                        <span>{formatearHora(t.hora_inicio)} - {formatearHora(t.hora_fin)}</span>
                      </div>
                      <span className="detalle-item-cancha">{t.cancha}</span>
                      <span className={claseEstado(t.estado)}>{t.estado}</span>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    );
  }

  // ------------------ Vista genérica (admin): tabla de clientes, con búsqueda, filtro y paginado reales ------------------
  return (
    <div className="usuarios-contenedor">
      <h1 className="titulo-tabla-admin">Listado de Clientes</h1>

      <div className="controles-lista-admin">
        <input
          type="text"
          className="buscador-lista-admin"
          placeholder="Buscar por nombre, usuario o correo..."
          value={busquedaAdminInput}
          onChange={(e) => setBusquedaAdminInput(e.target.value)}
        />
        <select className="filtro-lista-admin" value={estadoFiltroAdmin} onChange={(e) => handleFiltroEstadoAdmin(e.target.value)}>
          <option value="activo">Activos</option>
          <option value="baja">Dados de baja</option>
        </select>
      </div>

      {cargandoAdmin && <p className="usuarios-vacio">Cargando...</p>}
      {!cargandoAdmin && usuariosAdmin.length === 0 && <p className="usuarios-vacio">No se encontraron clientes.</p>}

      {!cargandoAdmin && usuariosAdmin.length > 0 && (
        <div className="tabla-usuarios-admin-wrap">
          <table className="tabla-usuarios-admin">
            <thead>
              <tr>
                <th className="th-ordenable" onClick={() => handleOrdenarAdmin('apellido')}>
                  Cliente {flechaColumnaAdmin('apellido')}
                </th>
                <th className="col-oculto-movil">Contacto</th>
                <th className="col-oculto-movil th-ordenable" onClick={() => handleOrdenarAdmin('fecha_registro')}>
                  En la plataforma desde {flechaColumnaAdmin('fecha_registro')}
                </th>
                <th className="centrado">Estado</th>
                <th className="centrado">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuariosAdmin.map((user) => {
                const nombreCompleto = user.nombre
                  ? `${user.nombre} ${user.apellido || ''}`.trim()
                  : user.usuario;

                const usuarioActivo = user.activo !== 0;

                return (
                  <tr key={user.id_usuario} className={!usuarioActivo ? 'fila-usuario-baja' : ''}>
                    <td>
                      <div className="col-cliente">
                        <div className="avatar-tabla">
                          {user.foto ? (
                            <img src={user.foto} alt={nombreCompleto} />
                          ) : (
                            <span>{iniciales(user)}</span>
                          )}
                        </div>
                        <div className="nombre-cliente">
                          <strong>{nombreCompleto}</strong>
                          <span>@{user.usuario}</span>
                        </div>
                      </div>
                    </td>

                    <td className="col-oculto-movil">
                      {user.correo && (
                        <a className="contacto-linea" href={`mailto:${user.correo}`}>✉️ {user.correo}</a>
                      )}
                      {user.telefono && (
                        <a className="contacto-linea" href={`tel:${user.telefono}`}>📞 {user.telefono}</a>
                      )}
                    </td>

                    <td className="col-oculto-movil">{formatearMesAno(user.fecha_registro)}</td>

                    <td className="centrado">
                      <span className={`badge-estado-usuario-tabla ${usuarioActivo ? 'badge-estado-usuario-activo' : 'badge-estado-usuario-baja'}`}>
                        {usuarioActivo ? 'Activo' : 'Dado de baja'}
                      </span>
                    </td>

                    <td className="centrado">
                      {user.id_usuario !== miId ? (
                        <button
                          type="button"
                          className={`btn-estado-usuario ${usuarioActivo ? 'btn-dar-baja' : 'btn-reactivar'}`}
                          disabled={procesandoId === user.id_usuario}
                          onClick={() => handleCambiarEstadoUsuario(user)}
                        >
                          {procesandoId === user.id_usuario
                            ? 'Procesando...'
                            : usuarioActivo ? 'Dar de baja' : 'Reactivar'}
                        </button>
                      ) : (
                        <span className="dato-secundario">Vos</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!cargandoAdmin && totalPaginasAdmin > 1 && (
        <div className="paginado-lista-admin">
          <button type="button" disabled={paginaAdmin <= 1} onClick={() => setPaginaAdmin((p) => p - 1)}>‹ Anterior</button>
          <span>Página {paginaAdmin} de {totalPaginasAdmin} ({totalAdmin} usuarios)</span>
          <button type="button" disabled={paginaAdmin >= totalPaginasAdmin} onClick={() => setPaginaAdmin((p) => p + 1)}>Siguiente ›</button>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
