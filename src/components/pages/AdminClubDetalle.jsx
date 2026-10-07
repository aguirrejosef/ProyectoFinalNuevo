import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import { apiFetch } from '../../api';
import './AdminClubDetalle.css';

const PRECIOS_PLANES = { basico: 50000, estandar: 80000, premium: 120000 };

const ETIQUETA_ESTADO = {
    activa: { texto: 'Al día', clase: 'badge-suscripcion-activa' },
    pausada: { texto: 'Pausada', clase: 'badge-suscripcion-pausada' },
    cancelada: { texto: 'Cancelada', clase: 'badge-suscripcion-cancelada' }
};

const formatearFecha = (fecha) => {
    if (!fecha) return 'No informada';
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatearPrecio = (monto) => `$${Number(monto).toLocaleString('es-AR')}`;

function AdminClubDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [club, setClub] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const cargar = async () => {
            setCargando(true);
            setError('');
            try {
                const res = await apiFetch(`/admin/clubes/${id}`);
                const data = await res.json();
                if (!res.ok) {
                    setError(data.message || 'No se pudo cargar el club');
                    return;
                }
                setClub(data);
            } catch (err) {
                console.error('Error al cargar el club:', err);
                setError('Error al conectar con el servidor');
            } finally {
                setCargando(false);
            }
        };

        cargar();
    }, [id]);

    if (cargando) {
        return (
            <div>
                <NavBar />
                <p className="mensaje-detalle-club">Cargando...</p>
                <Footer />
            </div>
        );
    }

    if (error || !club) {
        return (
            <div>
                <NavBar />
                <p className="mensaje-detalle-club">{error || 'Club no encontrado'}</p>
                <Footer />
            </div>
        );
    }

    const estado = club.en_mora
        ? { texto: 'Falta de pago', clase: 'badge-suscripcion-mora' }
        : ETIQUETA_ESTADO[club.estado_suscripcion] || null;
    const precioPlan = club.plan && PRECIOS_PLANES[club.plan] ? PRECIOS_PLANES[club.plan] : null;

    return (
        <div>
            <div className="no-imprimir">
                <NavBar />
            </div>

            <div className="contenedor-detalle-club">
                <button type="button" className="btn-volver-detalle no-imprimir" onClick={() => navigate('/admin')}>
                    ← Volver al panel
                </button>

                <div className="tarjeta-detalle-club">
                    <div className="encabezado-detalle-club">
                        <div>
                            <h1>{club.nombre}</h1>
                            <p className="subtitulo-detalle-club">Detalle de la suscripción</p>
                        </div>
                        {estado && <span className={`badge-suscripcion ${estado.clase}`}>{estado.texto}</span>}
                    </div>

                    {club.activo === 0 && (
                        <div className="aviso-baja-detalle-club">
                            <strong>Dado de baja el {formatearFecha(club.dado_de_baja_en)}</strong>
                            {club.motivo_baja && <p>Motivo: "{club.motivo_baja}"</p>}
                        </div>
                    )}

                    <div className="grid-detalle-club">
                        <div className="seccion-detalle-club">
                            <h3>Plan contratado</h3>
                            <p className="dato-grande">{club.plan ? club.plan.charAt(0).toUpperCase() + club.plan.slice(1) : 'Sin plan asignado'}</p>
                            {precioPlan && <p>{formatearPrecio(precioPlan)} / mes</p>}
                        </div>

                        <div className="seccion-detalle-club">
                            <h3>Próximo pago</h3>
                            <p className="dato-grande">{formatearFecha(club.proxima_fecha_pago)}</p>
                        </div>

                        <div className="seccion-detalle-club">
                            <h3>Cliente desde</h3>
                            <p className="dato-grande">{formatearFecha(club.fecha_alta)}</p>
                        </div>

                        <div className="seccion-detalle-club">
                            <h3>Canchas publicadas</h3>
                            <p className="dato-grande">{club.cantidad_canchas ?? 0}</p>
                        </div>
                    </div>

                    <div className="separador-detalle-club"></div>

                    <div className="grid-detalle-club">
                        <div className="seccion-detalle-club">
                            <h3>Datos del club</h3>
                            <p>{club.direccion || 'Sin dirección'}{club.localidad ? `, ${club.localidad}` : ''}</p>
                            {club.provincia && <p>{club.provincia}</p>}
                            <p>{club.telefono || 'Sin teléfono'}</p>
                        </div>

                        <div className="seccion-detalle-club">
                            <h3>Dueño de la cuenta</h3>
                            <p>{`${club.nombre_dueno || ''} ${club.apellido_dueno || ''}`.trim() || club.dueno || '-'}</p>
                            <p>{club.correo_dueno || '-'}</p>
                            <p>{club.telefono_dueno || '-'}</p>
                        </div>
                    </div>

                    <button type="button" className="btn-descargar-detalle no-imprimir" onClick={() => window.print()}>
                        Descargar detalles
                    </button>
                </div>
            </div>

            <div className="no-imprimir">
                <Footer />
            </div>
        </div>
    );
}

export default AdminClubDetalle;
