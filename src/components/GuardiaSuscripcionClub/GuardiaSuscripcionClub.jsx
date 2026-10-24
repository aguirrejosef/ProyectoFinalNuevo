import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch, cerrarSesion } from '../../api';
import './GuardiaSuscripcionClub.css';

const CONTENIDO_POR_MOTIVO = {
    mora: {
        titulo: 'Tu suscripción está vencida',
        texto: 'Para seguir usando tu panel, tus canchas, tus turnos y el resto de las funciones, primero necesitás ponerte al día con el pago de tu plan. Mientras tanto, solo podés acceder a la sección de Planes para regularizarlo.',
        textoBoton: 'Ir a Planes'
    },
    baja: {
        titulo: 'Tu club fue dado de baja',
        texto: 'Un administrador dio de baja tu club en la plataforma. Esto no se resuelve pagando un plan — escribinos para entender qué pasó y, si corresponde, reactivar tu cuenta.',
        textoBoton: null
    }
};

// Envuelve las pantallas del dueño de club que dependen de tener la cuenta
// habilitada. Si el admin dio de baja el club, o si la suscripción está
// vencida, en vez del contenido muestra un aviso bloqueante — con la sección
// de Planes como única salida cuando el motivo es de pago (dar de baja lo
// resuelve el admin, no un pago).
function GuardiaSuscripcionClub({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const rol = localStorage.getItem('rol');
    const esClub = Number(rol) === 2;

    const [cargando, setCargando] = useState(esClub);
    const [motivo, setMotivo] = useState(null);
    const [motivoBaja, setMotivoBaja] = useState('');

    useEffect(() => {
        if (!esClub) return;

        let cancelado = false;

        const verificar = async () => {
            try {
                const res = await apiFetch('/club/estado-pago');
                const data = await res.json();
                if (!cancelado && res.ok) {
                    setMotivo(data.bloqueado ? data.motivo : null);
                    setMotivoBaja(data.motivo_baja || '');
                }
            } catch (error) {
                console.error('Error al verificar el estado del club:', error);
            } finally {
                if (!cancelado) setCargando(false);
            }
        };

        verificar();
        return () => { cancelado = true; };
    }, [esClub, location.pathname]);

    if (!esClub) return children;

    // Evitamos el parpadeo en blanco mientras se consulta el estado: mejor
    // un mensaje breve que un hueco vacío por una fracción de segundo.
    if (cargando) {
        return <p className="guardia-suscripcion-cargando">Verificando el estado de tu cuenta...</p>;
    }

    if (motivo) {
        const contenido = CONTENIDO_POR_MOTIVO[motivo];

        return (
            <div className="guardia-suscripcion-overlay">
                <div className="guardia-suscripcion-tarjeta">
                    <span className="guardia-suscripcion-icono">⚠️</span>
                    <h2>{contenido.titulo}</h2>
                    <p>{contenido.texto}</p>
                    {motivo === 'baja' && motivoBaja && (
                        <p className="guardia-suscripcion-motivo">"{motivoBaja}"</p>
                    )}
                    <div className="guardia-suscripcion-botones">
                        {contenido.textoBoton && (
                            <button type="button" onClick={() => navigate('/planes')}>
                                {contenido.textoBoton}
                            </button>
                        )}
                        <button type="button" className="guardia-suscripcion-btn-secundario" onClick={cerrarSesion}>
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return children;
}

export default GuardiaSuscripcionClub;
