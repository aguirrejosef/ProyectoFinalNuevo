import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import { apiFetch } from '../../api';
import './ReservaConfirmacion.css';

const INTENTOS_MAXIMOS = 15;
const ESPERA_ENTRE_INTENTOS_MS = 3000;

function RegistroClubConfirmacion() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const idRegistro = searchParams.get('registro');

    const [estado, setEstado] = useState('cargando'); // cargando | aprobado | rechazado | pendiente | error

    useEffect(() => {
        if (!idRegistro) {
            setEstado('error');
            return;
        }

        let cancelado = false;

        const consultar = async (intento) => {
            try {
                const res = await apiFetch(`/registros-pendientes/estado/${idRegistro}`);
                const data = await res.json();

                if (cancelado) return;

                if (data.estado === 'aprobado' || data.estado === 'rechazado') {
                    setEstado(data.estado);
                    return;
                }

                if (data.estado === 'no_encontrado') {
                    setEstado('error');
                    return;
                }

                if (intento >= INTENTOS_MAXIMOS) {
                    setEstado('pendiente');
                    return;
                }

                setTimeout(() => consultar(intento + 1), ESPERA_ENTRE_INTENTOS_MS);

            } catch (error) {
                console.error('Error al consultar el estado del registro:', error);
                if (!cancelado) setEstado('error');
            }
        };

        consultar(1);

        return () => { cancelado = true; };
    }, [idRegistro]);

    const contenidoPorEstado = {
        cargando: {
            titulo: 'Confirmando el pago de tu plan...',
            texto: 'Esto puede tardar unos segundos.'
        },
        aprobado: {
            titulo: '¡Tu club ya está registrado! 🎉',
            texto: 'Ya podés iniciar sesión con el usuario y la contraseña que elegiste.'
        },
        rechazado: {
            titulo: 'El pago no se completó',
            texto: 'Tu club todavía no quedó registrado. Podés intentar de nuevo cuando quieras.'
        },
        pendiente: {
            titulo: 'Todavía estamos esperando la confirmación',
            texto: 'Puede demorar unos minutos más. Volvé a intentar iniciar sesión en un rato.'
        },
        error: {
            titulo: 'No pudimos verificar el pago',
            texto: 'Si el dinero fue debitado, escribinos para confirmar el registro de tu club.'
        }
    };

    const { titulo, texto } = contenidoPorEstado[estado];

    return (
        <div>
            <NavBar />
            <div className="contenedor-confirmacion-pago">
                <div className="tarjeta-confirmacion-pago">
                    {estado === 'cargando' && <div className="spinner-confirmacion"></div>}
                    <h2>{titulo}</h2>
                    <p>{texto}</p>

                    {estado !== 'cargando' && (
                        <div className="botones-confirmacion-pago">
                            {estado === 'aprobado' && (
                                <button type="button" onClick={() => navigate('/login')}>
                                    Iniciar sesión
                                </button>
                            )}
                            {estado === 'rechazado' && (
                                <button type="button" onClick={() => navigate('/registro-club')}>
                                    Intentar de nuevo
                                </button>
                            )}
                            {(estado === 'pendiente' || estado === 'error') && (
                                <button type="button" className="btn-secundario-confirmacion" onClick={() => navigate('/')}>
                                    Volver al inicio
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default RegistroClubConfirmacion;
