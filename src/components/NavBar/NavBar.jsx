import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import '../NavBar/NavBar.css';
import Logo from '../Logo/Logo';
import { apiFetch, cerrarSesion } from '../../api';

const capitalizar = (texto) => (texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto);

function NavBar() {
    const navigate = useNavigate();

    const [rol, setRol] = useState(null);
    const [nombre, setNombre] = useState('');
    const [foto, setFoto] = useState('');
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [proximoInfo, setProximoInfo] = useState(null);

    const menuRef = useRef(null);

    const leerPerfilDeLocalStorage = () => {
        const storedRol = localStorage.getItem('rol');
        setRol(storedRol);

        const storedNombre = localStorage.getItem('nombre');
        const storedFoto = localStorage.getItem('foto');

        setNombre(storedNombre || '');
        setFoto(storedFoto || '');
    };

    const cargarProximoTurno = () => {
        const storedRol = localStorage.getItem('rol');
        const storedId = localStorage.getItem('id');

        if (Number(storedRol) === 3 && storedId) {
            apiFetch(`/turnos/proximos-count?id_usuario=${storedId}`)
                .then((res) => res.json())
                .then((data) => setProximoInfo(data))
                .catch((err) => console.error('Error al obtener turnos próximos:', err));
        }
    };

    useEffect(() => {
        leerPerfilDeLocalStorage();
    }, []);

    // Turnos próximos (hoy o mañana), solo para clientes
    useEffect(() => {
        cargarProximoTurno();
    }, []);

    // El NavBar se monta una sola vez por página (no es un layout persistente
    // en todas las rutas), así que si el usuario edita su perfil o cancela/crea
    // un turno sin cambiar de página, estos eventos son la única forma de que
    // se entere y se refresque solo, sin esperar a la próxima navegación.
    useEffect(() => {
        window.addEventListener('perfil-actualizado', leerPerfilDeLocalStorage);
        window.addEventListener('turnos-actualizados', cargarProximoTurno);
        return () => {
            window.removeEventListener('perfil-actualizado', leerPerfilDeLocalStorage);
            window.removeEventListener('turnos-actualizados', cargarProximoTurno);
        };
    }, []);

    // Cierra el menú si se hace clic afuera
    useEffect(() => {
        const handleClickFuera = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setMenuAbierto(false);
            }
        };

        document.addEventListener('mousedown', handleClickFuera);
        return () => document.removeEventListener('mousedown', handleClickFuera);
    }, []);

    const botonesAdmin = [
        { label: 'Panel', path: '/admin' },
        { label: 'Historia', path: '/historia' },
        { label: 'Clubes', path: '/canchas' },
        { label: 'Usuarios', path: '/usuario' },
        { label: 'Novedades', path: '/novedades' },
        { label: 'Planes', path: '/planes' },
        { label: 'Balance', path: '/admin/balance' },
    ];

    const botonesClub = [
       /* { label: 'Historia', path: '/historia' },*/
        { label: 'Canchas', path: '/mis-canchas' },
        { label: 'Clientes', path: '/usuario' },
       /* { label: 'Novedades', path: '/novedades' },*/
        { label: 'Planes', path: '/planes' },
        { label: 'Balance', path: '/mi-balance' },
    ];

    const botonesCliente = [

        { label: 'Reservar Turno', path: '/canchas' },
        { label: 'Novedades', path: '/novedades' },
       /* { label: 'Planes', path: '/planes' },*/
        { label: 'Nosotros', path: '/historia' },
    ];

    const botonesVisitante = [
    { label: 'Reservar turno', path: '/canchas' },
    { label: 'Planes', path: '/planes' },
    { label: 'Adherí tu Club', path: '/registro-club' },
    { label: 'Nosotros', path: '/historia' },
    ];

    let botonesVisibles = botonesVisitante;

    if (Number(rol) === 1) {
    botonesVisibles = botonesAdmin;
    } else if (Number(rol) === 2) {
    botonesVisibles = botonesClub;
    } else if (Number(rol) === 3) {
    botonesVisibles = botonesCliente;
    }

    const handleLogout = () => {
        cerrarSesion();
    };

    const handleMiPerfil = () => {
        setMenuAbierto(false);
        navigate('/mi-perfil');
    };

    const handleMiTurno = () => {
        setMenuAbierto(false);
        navigate('/mis-turnos');
    };

    // Arma el texto "Tenés un turno hoy/mañana a las HH:MMhs en <club>"
    const formatearAvisoProximo = (turno) => {
        if (!turno) return '';

        const fechaTurno = String(turno.fecha).slice(0, 10);

        const hoyDate = new Date();
        const hoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')}`;

        const mananaDate = new Date();
        mananaDate.setDate(mananaDate.getDate() + 1);
        const manana = `${mananaDate.getFullYear()}-${String(mananaDate.getMonth() + 1).padStart(2, '0')}-${String(mananaDate.getDate()).padStart(2, '0')}`;

        const dia = fechaTurno === hoy ? 'hoy' : (fechaTurno === manana ? 'mañana' : fechaTurno);
        const hora = turno.hora_inicio ? turno.hora_inicio.slice(0, 5) : '';

        return `Tenés un turno ${dia} a las ${hora}hs en ${turno.club}`;
    };

    return (
        <div className="contenedor">
            <div className="contenedor-grid">
                <div className="grid-item1">
                    <Logo />
                </div>

                <div className="grid-item2">
                    <div className="nav-buttons">
                        {botonesVisibles.map((btn, i) => (
                            <button key={i} className="nav-btn" onClick={() => navigate(btn.path)}>
                                {btn.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid-item4">
                    {rol ? (
                        <div className="usuario-navbar" ref={menuRef}>

                            <div className="avatar-wrapper">
                                {foto ? (
                                    <img
                                        src={foto}
                                        alt="Foto de perfil"
                                        className="foto-usuario-navbar"
                                    />
                                ) : (
                                    <div className="avatar-default-navbar">
                                        {nombre ? nombre.charAt(0).toUpperCase() : '?'}
                                    </div>
                                )}

                                {Number(rol) === 3 && proximoInfo && proximoInfo.count > 0 && (
                                    <span className="badge-turno-proximo"></span>
                                )}
                            </div>

                            {/* BOTÓN CON EL NOMBRE */}
                            <button
                                className="nombre-usuario-navbar"
                                onClick={() => setMenuAbierto(!menuAbierto)}
                            >
                                {capitalizar(nombre)} ▾
                            </button>

                            {/* MENÚ DESPLEGABLE */}
                            {menuAbierto && (
                                <div className="menu-desplegable-usuario">

                                    {Number(rol) === 3 && proximoInfo && proximoInfo.proximo && (
                                        <div className="proximo-turno-aviso">
                                            📅 {formatearAvisoProximo(proximoInfo.proximo)}
                                        </div>
                                    )}

                                    <button onClick={handleMiPerfil}>
                                        Mi Perfil
                                    </button>
                                    {Number(rol) === 3 && (
                                        <button onClick={handleMiTurno}>
                                            Mis Reservas
                                        </button>
                                    )}
                                    <button className="btn-cerrar-sesion-navbar" onClick={handleLogout}>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            )}

                        </div>
                    ) : (
                        <button className="btn-iniciarSesion" onClick={() => navigate("/login")}>
                            Iniciar Sesión
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default NavBar;