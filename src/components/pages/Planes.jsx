import React, { useEffect, useState } from 'react'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import Footer from '../Footer/Footer'
import { useNavigate } from 'react-router-dom'
import './Planes.css'

// NOTA: los nombres, precios y beneficios de acá son PLACEHOLDER.
// Reemplazalos por los planes reales que va a ofrecer tu plataforma.
const PLANES = [
  {
    id: 'basico',
    nombre: 'Básico',
    precio: 'A definir',
    destacado: false,
    beneficios: [
      'Hasta 2 canchas publicadas',
      'Gestión de turnos',
      'Panel de administración del club'
    ]
  },
  {
    id: 'estandar',
    nombre: 'Estándar',
    precio: 'A definir',
    destacado: true,
    beneficios: [
      'Hasta 6 canchas publicadas',
      'Gestión de turnos',
      'Panel de administración del club',
      'Estadísticas de reservas'
    ]
  },
  {
    id: 'premium',
    nombre: 'Premium',
    precio: 'A definir',
    destacado: false,
    beneficios: [
      'Canchas ilimitadas',
      'Gestión de turnos',
      'Panel de administración del club',
      'Estadísticas de reservas',
      'Soporte prioritario'
    ]
  }
]

function Planes() {
  const navigate = useNavigate();

  const rol = localStorage.getItem('rol');
  const idUsuario = localStorage.getItem('id');
  const esClub = Number(rol) === 2;

  const [clubId, setClubId] = useState(null);
  const [planActual, setPlanActual] = useState(null);
  const [cambiando, setCambiando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!esClub) return;

    const cargarClub = async () => {
      try {
        const res = await fetch(`http://localhost:3000/club/mi-club?id_usuario=${idUsuario}`);
        const data = await res.json();

        if (res.ok) {
          setClubId(data.id_club);
          setPlanActual(data.plan || 'basico');
        }
      } catch (err) {
        console.error('Error al cargar el club:', err);
      }
    };

    cargarClub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleElegirPlan = (plan) => {
    // Se pasa el plan elegido al formulario de registro del club,
    // así en RegistroClub.jsx se puede leer con: useLocation().state?.planSeleccionado
    navigate('/registro-club', { state: { planSeleccionado: plan.id } });
  };

  const handleCambiarPlan = async (plan) => {
    if (plan.id === planActual) return;

    setCambiando(true);
    setMensaje('');

    try {
      const res = await fetch(`http://localhost:3000/club/${clubId}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.id })
      });

      const data = await res.json();

      if (!res.ok) {
        setMensaje(data.message || 'No se pudo cambiar el plan');
        setCambiando(false);
        return;
      }

      setPlanActual(plan.id);
      setMensaje(`Listo, ahora tenés el plan ${plan.nombre}.`);

    } catch (err) {
      console.error('Error al cambiar el plan:', err);
      setMensaje('Error al conectar con el servidor');
    } finally {
      setCambiando(false);
    }
  };

  return (
    <div>
      <NavBar/>

      <div className="planes-contenedor">
        <h2 className="planes-titulo">Planes para tu club</h2>
        <p className="planes-subtitulo">
          {esClub
            ? 'Este es tu plan actual. Podés cambiarlo cuando quieras.'
            : 'Elegí el plan que mejor se adapte a tu club. Podés cambiarlo más adelante.'}
        </p>

        {esClub && mensaje && <p className="planes-mensaje">{mensaje}</p>}

        <div className="planes-grid">
          {PLANES.map((plan) => {
            const esElActual = esClub && planActual === plan.id;

            return (
              <div
                key={plan.id}
                className={`plan-card ${plan.destacado ? 'plan-destacado' : ''} ${esElActual ? 'plan-actual' : ''}`}
              >
                {esElActual ? (
                  <span className="plan-badge plan-badge-actual">Tu plan actual</span>
                ) : (
                  plan.destacado && <span className="plan-badge">Más elegido</span>
                )}

                <h3 className="plan-nombre">{plan.nombre}</h3>
                <p className="plan-precio">{plan.precio}</p>

                <ul className="plan-beneficios">
                  {plan.beneficios.map((beneficio, i) => (
                    <li key={i}>{beneficio}</li>
                  ))}
                </ul>

                {esClub ? (
                  <button
                    type="button"
                    className="plan-boton"
                    onClick={() => handleCambiarPlan(plan)}
                    disabled={esElActual || cambiando}
                  >
                    {esElActual ? 'Plan actual' : (cambiando ? 'Cambiando...' : 'Cambiar plan')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="plan-boton"
                    onClick={() => handleElegirPlan(plan)}
                  >
                    Elegir plan
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="contenedor-btnFlotanteWsp">
        <BtnFlotanteWp
          NroCelular={'3814653130'}
        />
      </div>
      <Footer/>
    </div>
  )
}

export default Planes