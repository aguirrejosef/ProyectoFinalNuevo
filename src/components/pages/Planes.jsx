import React, { useEffect, useState } from 'react'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import Footer from '../Footer/Footer'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './Planes.css'
import { apiFetch } from '../../api'

// Mercado Pago se abre en otra pestaña y el usuario puede tardar en pagar
// ahí, así que esperamos varios minutos en vez de solo unos segundos.
const INTENTOS_MAXIMOS_CAMBIO_PLAN = 120;
const ESPERA_ENTRE_INTENTOS_CAMBIO_PLAN_MS = 5000;

// NOTA: los beneficios de cada plan son PLACEHOLDER, ajustalos si hace falta.
// Los precios deben coincidir con PRECIOS_PLANES en src/backend/db.js.
const PLANES = [
  {
    id: 'basico',
    nombre: 'Básico',
    precio: '$50.000/mes',
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
    precio: '$80.000/mes',
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
    precio: '$120.000/mes',
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
  const [searchParams, setSearchParams] = useSearchParams();

  const rol = localStorage.getItem('rol');
  const esClub = Number(rol) === 2;

  const [clubId, setClubId] = useState(null);
  const [planActual, setPlanActual] = useState(null);
  const [cambiando, setCambiando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [planAImprimir, setPlanAImprimir] = useState(null);
  const [verificandoCambioPlan, setVerificandoCambioPlan] = useState(false);

  useEffect(() => {
    if (!planAImprimir) return;
    const timer = setTimeout(() => window.print(), 150);
    return () => clearTimeout(timer);
  }, [planAImprimir]);

  useEffect(() => {
    const limpiarPlanAImprimir = () => setPlanAImprimir(null);
    window.addEventListener('afterprint', limpiarPlanAImprimir);
    return () => window.removeEventListener('afterprint', limpiarPlanAImprimir);
  }, []);

  useEffect(() => {
    if (!esClub) return;

    const cargarClub = async () => {
      try {
        const res = await apiFetch('/club/mi-club');
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

  // Consulta el estado real del cambio de plan hasta que se defina (aprobado
  // o rechazado). La usamos apenas se abre Mercado Pago en la pestaña nueva,
  // y también si el usuario vuelve a entrar con ?cambioPlan= en la URL.
  const iniciarVerificacionCambioPlan = (idClub, limpiarUrl) => {
    let cancelado = false;
    setVerificandoCambioPlan(true);
    setMensaje('Esperando el pago del nuevo plan...');

    const consultar = async (intento) => {
      try {
        const res = await apiFetch(`/club/${idClub}/estado-cambio-plan`);
        const data = await res.json();

        if (cancelado) return;

        if (data.estado === 'aprobado') {
          setPlanActual(data.plan);
          setMensaje(`Listo, ahora tenés el plan ${PLANES.find((p) => p.id === data.plan)?.nombre || data.plan}.`);
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        if (data.estado === 'rechazado') {
          setMensaje('El pago del nuevo plan no se completó. Podés intentarlo de nuevo.');
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        if (data.estado === 'sin_cambio' || intento >= INTENTOS_MAXIMOS_CAMBIO_PLAN) {
          setMensaje('Todavía estamos esperando la confirmación del pago. Volvé a esta página en unos minutos.');
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        setTimeout(() => consultar(intento + 1), ESPERA_ENTRE_INTENTOS_CAMBIO_PLAN_MS);

      } catch (err) {
        console.error('Error al consultar el cambio de plan:', err);
        if (!cancelado) {
          setMensaje('No pudimos confirmar el pago. Volvé a esta página en unos minutos.');
          setVerificandoCambioPlan(false);
        }
      }
    };

    consultar(1);

    return () => { cancelado = true; };
  };

  // Si el usuario vuelve a entrar con ?cambioPlan= en la URL (por ejemplo,
  // porque Mercado Pago lo redirigió con el back_url), retomamos la consulta.
  useEffect(() => {
    const idClubEnUrl = searchParams.get('cambioPlan');
    if (!idClubEnUrl || !clubId) return;

    const limpiarUrl = () => {
      const nuevosParams = new URLSearchParams(searchParams);
      nuevosParams.delete('cambioPlan');
      setSearchParams(nuevosParams, { replace: true });
    };

    return iniciarVerificacionCambioPlan(clubId, limpiarUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

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
      const res = await apiFetch(`/club/${clubId}/cambiar-plan`, {
        method: 'POST',
        body: JSON.stringify({ plan: plan.id })
      });

      const data = await res.json();

      if (!res.ok) {
        setMensaje(data.message || 'No se pudo iniciar el cambio de plan');
        setCambiando(false);
        return;
      }

      if (!data.init_point) {
        setMensaje('Los pagos no están disponibles en este momento. Contactanos para cambiar el plan.');
        setCambiando(false);
        return;
      }

      // Abrimos Mercado Pago en una pestaña nueva y nos quedamos acá
      // consultando el estado del cambio de plan, igual que al pagar
      // la seña de una reserva.
      window.open(data.init_point, '_blank');
      setCambiando(false);
      iniciarVerificacionCambioPlan(clubId);

    } catch (err) {
      console.error('Error al cambiar el plan:', err);
      setMensaje('Error al conectar con el servidor');
      setCambiando(false);
    }
  };

  return (
    <div>
      <div className="no-imprimir">
        <NavBar/>
      </div>

      <div className="planes-contenedor no-imprimir">
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
                    disabled={esElActual || cambiando || verificandoCambioPlan}
                  >
                    {esElActual ? 'Plan actual' : (cambiando ? 'Generando el pago...' : 'Cambiar plan')}
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

                <button
                  type="button"
                  className="plan-boton-pdf"
                  onClick={() => setPlanAImprimir(plan)}
                >
                  Descargar PDF
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="contenedor-btnFlotanteWsp no-imprimir">
        <BtnFlotanteWp
          NroCelular={'3814653130'}
        />
      </div>
      <div className="no-imprimir">
        <Footer/>
      </div>

      {planAImprimir && (
        <div className="hoja-plan-impresion">
          <div className="hoja-plan-header">
            <h1>SUP - Sale un Pádel</h1>
            <p>Detalle del plan para clubes</p>
          </div>

          <h2 className="hoja-plan-nombre">Plan {planAImprimir.nombre}</h2>
          <p className="hoja-plan-precio">{planAImprimir.precio}</p>

          <ul className="hoja-plan-beneficios">
            {planAImprimir.beneficios.map((beneficio, i) => (
              <li key={i}>{beneficio}</li>
            ))}
          </ul>

          <p className="hoja-plan-fecha">
            Generado el {new Date().toLocaleDateString('es-AR')}
          </p>
        </div>
      )}
    </div>
  )
}

export default Planes