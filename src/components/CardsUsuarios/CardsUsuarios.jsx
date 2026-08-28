import React, { useState, useEffect } from 'react';
import './CardsUsuarios.css';
import { apiFetch } from '../../api';

const UMBRAL_CLIENTE_FRECUENTE = 5;

const Usuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  // Orden de la tabla
  const [campoOrden, setCampoOrden] = useState('total_turnos');
  const [direccionOrden, setDireccionOrden] = useState('desc');

  // Detalle de cliente (historial de turnos)
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [turnosCliente, setTurnosCliente] = useState([]);
  const [cargandoTurnos, setCargandoTurnos] = useState(false);

  const rol = localStorage.getItem('rol');

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const response = await apiFetch('/usuarios');

        const data = await response.json();
        setUsuarios(data);

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  const getRol = (idRol) => {
    if (idRol === 1) return 'Admin';
    if (idRol === 2) return 'Club';
    if (idRol === 3) return 'Cliente';
    return 'Desconocido';
  };

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

  // ------------------ Abrir / cerrar detalle de cliente ------------------
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

  // ------------------ Orden de columnas ------------------
  const handleOrdenar = (campo) => {
    if (campoOrden === campo) {
      setDireccionOrden(direccionOrden === 'asc' ? 'desc' : 'asc');
    } else {
      setCampoOrden(campo);
      // texto arranca ascendente, numéricos/fechas arrancan descendente
      setDireccionOrden(campo === 'nombre' ? 'asc' : 'desc');
    }
  };

  const flechaColumna = (campo) => {
    if (campoOrden !== campo) return <span className="th-arrow th-arrow-inactiva">▾</span>;
    return <span className="th-arrow th-arrow-activa">{direccionOrden === 'asc' ? '▴' : '▾'}</span>;
  };

  const valorOrdenable = (user, campo) => {
    if (campo === 'nombre') {
      return (user.nombre ? `${user.nombre} ${user.apellido || ''}` : user.usuario || '').toLowerCase();
    }
    if (campo === 'fecha_registro') {
      return user.fecha_registro ? new Date(user.fecha_registro).getTime() : 0;
    }
    if (campo === 'total_turnos') {
      return Number(user.total_turnos) || 0;
    }
    if (campo === 'ultima_reserva') {
      return user.ultima_reserva ? new Date(user.ultima_reserva).getTime() : 0;
    }
    return 0;
  };

  const textoBusqueda = busqueda.trim().toLowerCase();
  const usuariosFiltrados = usuarios.filter((u) => {
    if (!textoBusqueda) return true;
    const campos = [u.nombre, u.apellido, u.usuario, u.correo].filter(Boolean).join(' ').toLowerCase();
    return campos.includes(textoBusqueda);
  });

  const usuariosOrdenados = [...usuariosFiltrados].sort((a, b) => {
    const va = valorOrdenable(a, campoOrden);
    const vb = valorOrdenable(b, campoOrden);
    if (va < vb) return direccionOrden === 'asc' ? -1 : 1;
    if (va > vb) return direccionOrden === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) return <div className="usuarios-cargando">Cargando...</div>;

  // ------------------ Vista CLUB: tabla de clientes con estadísticas ------------------
  if (Number(rol) === 2) {
    return (
      <div className="usuarios-contenedor">

        <h1 className="usuarios-titulo">Listado de Usuarios</h1>

        <div className="usuarios-buscador">
          <input
            type="text"
            placeholder="Buscar cliente por nombre, usuario o correo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {usuariosOrdenados.length === 0 && (
          <p className="usuarios-vacio">
            {usuarios.length === 0
              ? 'Todavía no tenés clientes que hayan reservado en tu club.'
              : 'No se encontró ningún cliente con esa búsqueda.'}
          </p>
        )}

        {usuariosOrdenados.length > 0 && (
          <div className="tabla-usuarios-wrap">
            <table className="tabla-usuarios">
              <thead>
                <tr>
                  <th onClick={() => handleOrdenar('nombre')}>
                    Cliente {flechaColumna('nombre')}
                  </th>
                  <th className="col-oculto-movil">Contacto</th>
                  <th className="col-oculto-movil" onClick={() => handleOrdenar('fecha_registro')}>
                    Cliente desde {flechaColumna('fecha_registro')}
                  </th>
                  <th className="centrado" onClick={() => handleOrdenar('total_turnos')}>
                    Turnos {flechaColumna('total_turnos')}
                  </th>
                  <th className="centrado" onClick={() => handleOrdenar('ultima_reserva')}>
                    Última reserva {flechaColumna('ultima_reserva')}
                  </th>
                  <th className="centrado">Estado</th>
                </tr>
              </thead>
              <tbody>
                {usuariosOrdenados.map((user) => (
                  <tr
                    key={user.id_usuario}
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
                  </tr>
                ))}
              </tbody>
            </table>
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

  // ------------------ Vista genérica (admin u otros roles) ------------------
  return (
    <div className="users-list">
      {usuariosOrdenados.map((user) => (
        <div key={user.id_usuario} className="user-card">
          <div className="cliente-avatar cliente-avatar-generico">
            <span>{iniciales(user)}</span>
          </div>

          <div className="user-card__info">
            <h3>{user.usuario}</h3>
            <p>{user.correo}</p>
            <p><strong>Rol:</strong> {getRol(user.id_rol)}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Usuarios;