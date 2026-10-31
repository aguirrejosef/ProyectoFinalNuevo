import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/NavBar';
import Footer from '../Footer/Footer';
import { apiFetch } from '../../api';
import './ReservaConfirmacion.css';

// Mercado Pago se abre en otra pestaña y el usuario puede tardar en pagar
// ahí, así que esperamos varios minutos en vez de solo unos segundos.
const INTENTOS_MAXIMOS = 120;
const ESPERA_ENTRE_INTENTOS_MS = 5000;
// Si la pestaña original no recibe el aviso de la otra pestaña en este
// tiempo (por ej. si la cerraron sin apretar el botón), le mostramos el
// botón igual para que pueda continuar por su cuenta.
const ESPERA_RESPALDO_MS = 5000;

function RegistroClubConfirmacion() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const idRegistro = searchParams.get('registro');

    // La pestaña original (donde se completó el formulario) llega acá con
    // ?origen=espera (ver FormRegistro.jsx). El back_url que le dimos a
    // Mercado Pago para la pestaña que abrió el checkout no incluye ese
    // parámetro, así que se distinguen leyendo la propia URL.
    const esPestanaOriginal = searchParams.get('origen') === 'espera';

    const [estado, setEstado] = useState('cargando'); // cargando | aprobado | rechazado | pendiente | error
    const [mostrarBotonRespaldo, setMostrarBotonRespaldo] = useState(false);
    const canalRef = useRef(null);

    // Canal para que la pestaña de Mercado Pago le avise a la original que
    // ya puede ir a iniciar sesión.
    useEffect(() => {
        if (!idRegistro) return;

        const canal = new BroadcastChannel(`registro-club-${idRegistro}`);
        canalRef.current = canal;

        if (esPestanaOriginal) {
            canal.onmessage = (evento) => {
                if (evento.data?.tipo === 'continuar') {
                    navigate('/login');
                }
            };
        }

        return () => canal.close();
    }, [idRegistro, esPestanaOriginal, navigate]);

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

    useEffect(() => {
        if (estado !== 'aprobado' || !esPestanaOriginal) return;
        const timer = setTimeout(() => setMostrarBotonRespaldo(true), ESPERA_RESPALDO_MS);
        return () => clearTimeout(timer);
    }, [estado, esPestanaOriginal]);

    const handleContinuar = () => {
        if (canalRef.current) {
            canalRef.current.postMessage({ tipo: 'continuar' });
        }
        if (esPestanaOriginal) {
            navigate('/login');
        } else {
            window.close();
        }
    };

    const contenidoPorEstado = {
        cargando: {
            titulo: 'Esperando el pago de tu plan...',
            texto: esPestanaOriginal
                ? 'Completá el pago en la pestaña de Mercado Pago que se abrió. En cuanto lo confirmes, esta pantalla se va a actualizar sola.'
                : 'Completá el pago acá. Cuando termines, te va a aparecer un botón para continuar.'
        },
        aprobado: {
            titulo: '¡Tu club ya está registrado! 🎉',
            texto: esPestanaOriginal
                ? 'Hacé clic en "Iniciar sesión" en la otra pestaña para continuar.'
                : 'Ya podés iniciar sesión con el usuario y la contraseña que elegiste.'
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

                    {estado === 'aprobado' && !esPestanaOriginal && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={handleContinuar}>
                                Iniciar sesión
                            </button>
                        </div>
                    )}

                    {estado === 'aprobado' && esPestanaOriginal && mostrarBotonRespaldo && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={handleContinuar}>
                                Iniciar sesión
                            </button>
                        </div>
                    )}

                    {estado === 'rechazado' && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" onClick={() => navigate('/registro-club')}>
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {(estado === 'pendiente' || estado === 'error') && (
                        <div className="botones-confirmacion-pago">
                            <button type="button" className="btn-secundario-confirmacion" onClick={() => navigate('/')}>
                                Volver al inicio
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    );
}

export default RegistroClubConfirmacion;
