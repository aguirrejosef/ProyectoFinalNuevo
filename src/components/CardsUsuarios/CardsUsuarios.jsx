import React, { useState, useEffect, useCallback } from 'react';
import './CardsUsuarios.css';
import { apiFetch } from '../../api';
import ModalBaja from '../Modal/ModalBaja';
import Toast from '../Toast/Toast';

const UMBRAL_CLIENTE_FRECUENTE = 5;
const LIMITE_ADMIN = 12;
const LIMITE_CLUB = 12;

const Usuarios = ({ onCambioEstado }) => {
  const rol = localStorage.getItem('rol');
  const miId = Number(localStorage.getItem('id'));
  const esClub = Number(rol) === 2;

  // ------------------ Vista CLUB: búsqueda, filtro, orden y paginado reales en el backend ------------------
  const [clientesClub, setClientesClub] = useState([]);
  const [cargandoClub, setCargandoClub] = useState(true);
  const [errorClub, setErrorClub] = useState('');
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
  const [errorTurnosCliente, setErrorTurnosCliente] = useState('');

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
  const [clienteEnConfirmacion, setClienteEnConfirmacion] = useState(null);
  const [errorAdmin, setErrorAdmin] = useState('');
  const [toast, setToast] = useState(null);

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
    setErrorClub('');
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

      if (!res.ok) {
        setClientesClub([]);
        setErrorClub(data.message || 'No se pudo cargar la lista de clientes.');
        return;
      }

      setClientesClub(Array.isArray(data.clientes) ? data.clientes : []);
      setTotalClub(data.total || 0);
      setTotalPaginasClub(data.totalPaginas || 1);
    } catch (error) {
      console.error('Error al cargar clientes del club:', error);
      setClientesClub([]);
      setErrorClub('No se pudo cargar la lista de clientes. Revisá tu conexión.');
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
    setErrorAdmin('');
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
      if (!res.ok) throw new Error('Respuesta no OK del servidor');
      const data = await res.json();
      const nuevoTotalPaginas = data.totalPaginas || 1;

      // Si se dio de baja/reactivó el único cliente de la última página, esa
      // página deja de existir: volvemos a la última válida en vez de
      // quedarnos mostrando una lista vacía.
      if (paginaAdmin > nuevoTotalPaginas) {
        setPaginaAdmin(nuevoTotalPaginas);
        return;
      }

      setUsuariosAdmin(Array.isArray(data.usuarios) ? data.usuarios : []);
      setTotalAdmin(data.total || 0);
      setTotalPaginasAdmin(nuevoTotalPaginas);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      setUsuariosAdmin([]);
      setErrorAdmin('No se pudo cargar la lista de clientes. Revisá tu conexión e intentá de nuevo.');
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

  const NOMBRES_ESTADO = {
    reservado: 'Reservado',
    completado: 'Completado',
    cancelado: 'Cancelado',
    pendiente_pago: 'Pendiente de pago'
  };

  const claseEstado = (estado) => {
    const e = (estado || '').toLowerCase();
    if (e === 'reservado') return 'estado-badge estado-reservado';
    if (e === 'cancelado') return 'estado-badge estado-cancelado';
    if (e === 'completado') return 'estado-badge estado-completado';
    if (e === 'pendiente_pago') return 'estado-badge estado-pendiente_pago';
    return 'estado-badge';
  };

  // ------------------ Abrir / cerrar detalle de cliente (vista club) ------------------
  const handleAbrirDetalle = async (user) => {
    setClienteSeleccionado(user);
    setCargandoTurnos(true);
    setTurnosCliente([]);
    setErrorTurnosCliente('');

    try {
      const res = await apiFetch(
        `/club/turnos-cliente?id_usuario=${user.id_usuario}`
      );
      const data = await res.json();

      if (!res.ok) {
        setErrorTurnosCliente((data && data.message) || 'No se pudieron cargar los turnos de este cliente.');
        return;
      }

      setTurnosCliente(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar turnos del cliente:', error);
      setErrorTurnosCliente('No se pudieron cargar los turnos de este cliente. Revisá tu conexión.');
    } finally {
      setCargandoTurnos(false);
    }
  };

  const handleCerrarDetalle = () => {
    setClienteSeleccionado(null);
    setTurnosCliente([]);
  };

  // ------------------ Dar de baja / reactivar usuario (solo admin) ------------------
  // Reactivar es directo; dar de baja pide confirmación primero (ver
  // handleClickEstadoUsuario), igual que ya pasa con los clubes.
  const handleCambiarEstadoUsuario = async (user) => {
    const nuevoActivo = user.activo === 0 ? 1 : 0;
    setProcesandoId(user.id_usuario);

    try {
      const res = await apiFetch(`/usuarios/${user.id_usuario}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ activo: nuevoActivo })
      });

      if (res.ok) {
        // Volvemos a pedir la página actual al backend en vez de solo
        // parchear la fila: así, si el cliente ya no cumple el filtro de
        // estado puesto (ej. "Activos"), desaparece de la lista, y el total
        // de la paginación también queda bien.
        await cargarUsuariosAdmin();
        // Avisa al panel para que las tarjetas y chips de arriba se refresquen también.
        onCambioEstado?.();
        setToast({
          tipo: 'exito',
          mensaje: nuevoActivo ? 'Cliente reactivado correctamente.' : 'Cliente dado de baja correctamente.'
        });
      } else {
        const data = await res.json().catch(() => ({}));
        setToast({ tipo: 'error', mensaje: data.message || 'No se pudo cambiar el estado del usuario' });
      }
    } catch (error) {
      console.error('Error al cambiar estado del usuario:', error);
      setToast({ tipo: 'error', mensaje: 'Ocurrió un error al conectar con el servidor' });
    } finally {
      setProcesandoId(null);
      setClienteEnConfirmacion(null);
    }
  };

  const handleClickEstadoUsuario = (user) => {
    if (user.activo === 0) {
      handleCambiarEstadoUsuario(user); // reactivar: directo, sin confirmación
    } else {
      setClienteEnConfirmacion(user); // dar de baja: pide confirmación antes
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

        <h1 className="usuarios-titulo">Listado de Clientes</h1>

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

        {!cargandoClub && errorClub && <p className="usuarios-vacio usuarios-error">{errorClub}</p>}

        {!cargandoClub && !errorClub && clientesClub.length === 0 && (
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
                  <th className="th-ordenable" onClick={() => handleOrdenarClub('nombre')}>
                    Cliente {flechaColumnaClub('nombre')}
                  </th>
                  <th className="col-oculto-movil">Contacto</th>
                  <th className="col-oculto-movil th-ordenable" onClick={() => handleOrdenarClub('fecha_registro')}>
                    Cliente desde {flechaColumnaClub('fecha_registro')}
                  </th>
                  <th className="centrado th-ordenable" onClick={() => handleOrdenarClub('total_turnos')}>
                    Turnos {flechaColumnaClub('total_turnos')}
                  </th>
                  <th className="centrado th-ordenable" onClick={() => handleOrdenarClub('ultima_reserva')}>
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
                          <span className={claseEstado(user.ultimo_estado)}>{NOMBRES_ESTADO[user.ultimo_estado] || user.ultimo_estado}</span>
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

              {cargandoTurnos && <p className="detalle-vacio-usuario">Cargando turnos...</p>}

              {!cargandoTurnos && errorTurnosCliente && (
                <p className="detalle-vacio-usuario detalle-error">{errorTurnosCliente}</p>
              )}

              {!cargandoTurnos && !errorTurnosCliente && turnosCliente.length === 0 && (
                <p className="detalle-vacio-usuario">Este cliente todavía no tiene turnos registrados.</p>
              )}

              {!cargandoTurnos && !errorTurnosCliente && turnosCliente.length > 0 && (
                <div className="detalle-lista">
                  {turnosCliente.map((t) => (
                    <div key={t.id_turno} className="detalle-item">
                      <div className="detalle-item-fecha">
                        <strong>{formatearFecha(t.fecha)}</strong>
                        <span>{formatearHora(t.hora_inicio)} - {formatearHora(t.hora_fin)}</span>
                      </div>
                      <span className="detalle-item-cancha">{t.cancha}</span>
                      <span className={claseEstado(t.estado)}>{NOMBRES_ESTADO[t.estado] || t.estado}</span>
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
      {!cargandoAdmin && errorAdmin && <p className="usuarios-vacio usuarios-error">{errorAdmin}</p>}
      {!cargandoAdmin && !errorAdmin && usuariosAdmin.length === 0 && (
        <p className="usuarios-vacio">
          {busquedaAdmin || estadoFiltroAdmin !== 'activo'
            ? 'No se encontró ningún cliente con esa búsqueda o filtro.'
            : 'Todavía no hay clientes registrados.'}
        </p>
      )}

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
                          onClick={() => handleClickEstadoUsuario(user)}
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

      {clienteEnConfirmacion && (
        <ModalBaja
          show={!!clienteEnConfirmacion}
          onAccept={() => handleCambiarEstadoUsuario(clienteEnConfirmacion)}
          onCancel={() => setClienteEnConfirmacion(null)}
          mensaje={`¿Dar de baja a ${clienteEnConfirmacion.nombre || clienteEnConfirmacion.usuario}? Va a dejar de poder iniciar sesión hasta que lo reactives.`}
          procesando={procesandoId === clienteEnConfirmacion.id_usuario}
        />
      )}

      <Toast mensaje={toast?.mensaje} tipo={toast?.tipo} onCerrar={() => setToast(null)} />
    </div>
  );
};

export default Usuarios;
