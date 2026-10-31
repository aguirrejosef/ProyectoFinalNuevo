import React, { useEffect, useRef, useState } from 'react'
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

// NOTA: los beneficios cortos ("beneficios") son los que se ven en las
// tarjetas de precios en pantalla. "descripcionLarga", "idealPara" y
// "detalleBeneficios" son textos más extensos que solo se usan en el PDF
// descargable, para que quede como un documento explicativo de verdad y no
// solo una lista de precios.
// Los precios deben coincidir con PRECIOS_PLANES en src/backend/db.js.
const PLANES = [
  {
    id: 'basico',
    nombre: 'Básico',
    precio: '$5.000/mes',
    destacado: false,
    beneficios: [
      'Hasta 4 canchas publicadas',
      'Gestión de turnos',
      'Panel de administración del club'
    ],
    idealPara: 'Clubes chicos que recién empiezan a tomar reservas online, con pocas canchas y un volumen de turnos manejable todavía a mano.',
    descripcionLarga: 'El plan Básico está pensado para que cualquier club, por más chico que sea, pueda empezar a recibir reservas por internet sin pagar de más por funciones que todavía no necesita. Con este plan tu club aparece en las búsquedas públicas de SUP, tus clientes pueden ver tus canchas, consultar disponibilidad en tiempo real y reservar un turno pagando la seña de forma online, sin que vos tengas que estar atendiendo el teléfono o el WhatsApp todo el día para confirmar horarios a mano.',
    detalleBeneficios: [
      { titulo: 'Hasta 4 canchas publicadas', texto: 'Podés cargar hasta cuatro canchas, cada una con su propia foto, tipo de superficie, horario de disponibilidad y precio — incluso un precio distinto para los turnos nocturnos si tu club los maneja así.' },
      { titulo: 'Gestión de turnos', texto: 'Desde tu panel ves todos los turnos reservados ordenados por fecha, podés cancelarlos si hace falta (se le avisa al cliente por correo) y marcar cuándo te pagaron el resto de la reserva en el club.' },
      { titulo: 'Panel de administración del club', texto: 'Un panel propio, separado del que usan tus clientes, donde manejás en un solo lugar la información de tu club, tus canchas, tus turnos y tus datos de contacto.' },
      { titulo: 'Cobro de señas con Mercado Pago', texto: 'Cada reserva se confirma con una seña que el cliente paga online en el momento de reservar, así se reducen las reservas que después nadie usa, y el resto del pago lo cobrás vos directamente en el club.' }
    ]
  },
  {
    id: 'estandar',
    nombre: 'Estándar',
    precio: '$8.000/mes',
    destacado: true,
    beneficios: [
      'Hasta 6 canchas publicadas',
      'Gestión de turnos',
      'Panel de administración del club',
      'Estadísticas de reservas'
    ],
    idealPara: 'Clubes en crecimiento, con varias canchas y un flujo constante de reservas, que ya necesitan entender mejor cómo les está yendo mes a mes.',
    descripcionLarga: 'El plan Estándar suma todo lo del plan Básico pero pensado para un club que ya maneja un volumen de reservas más grande y varias canchas a la vez. Además de recibir reservas online, vas a poder ver de un vistazo qué tan ocupado está tu club, qué canchas se reservan más y cuánto estás facturando, información que te sirve para tomar mejores decisiones sobre precios, horarios y promociones.',
    detalleBeneficios: [
      { titulo: 'Hasta 6 canchas publicadas', texto: 'Espacio para cargar hasta seis canchas distintas, cada una con su propia configuración de precios, fotos y disponibilidad — ideal para un club con varias superficies o modalidades de juego.' },
      { titulo: 'Gestión de turnos', texto: 'Las mismas herramientas de gestión del plan Básico: calendario de turnos, cancelaciones con aviso automático al cliente, y control de qué turnos ya se cobraron por completo.' },
      { titulo: 'Panel de administración del club', texto: 'El mismo panel centralizado del plan Básico, con lugar de sobra para manejar más canchas y más turnos sin que se vuelva un quilombo.' },
      { titulo: 'Estadísticas de reservas', texto: 'Un resumen con la cantidad de turnos reservados, completados y cancelados, cuántos clientes distintos te eligieron, cuál es tu cancha más reservada y cuánto ingresaste en el período que elijas — todo descargable también en Excel con diseño.' }
    ]
  },
  {
    id: 'premium',
    nombre: 'Premium',
    precio: '$12.000/mes',
    destacado: false,
    beneficios: [
      'Canchas ilimitadas',
      'Gestión de turnos',
      'Panel de administración del club',
      'Estadísticas de reservas',
      'Soporte prioritario'
    ],
    idealPara: 'Clubes grandes o cadenas con muchas canchas, mucho movimiento de reservas, y que necesitan que cualquier problema se resuelva rápido porque no se pueden dar el lujo de estar sin el sistema andando.',
    descripcionLarga: 'El plan Premium es el más completo: pensado para clubes que ya operan a gran escala y para quienes la plataforma pasó a ser una parte central de cómo manejan el negocio día a día. Incluye absolutamente todo lo de los otros dos planes, sin límite en la cantidad de canchas que podés publicar, y con atención prioritaria de nuestro lado ante cualquier consulta o problema.',
    detalleBeneficios: [
      { titulo: 'Canchas ilimitadas', texto: 'Publicá todas las canchas que tenga tu club, sin tope — pensado para clubes grandes, complejos con varias disciplinas o cadenas con más de una sede.' },
      { titulo: 'Gestión de turnos', texto: 'Las mismas herramientas de gestión de los otros planes, con capacidad de sobra para manejar un volumen alto de turnos simultáneos sin que el panel se vuelva lento o confuso.' },
      { titulo: 'Panel de administración del club', texto: 'El panel completo de administración, con todo lo necesario para que manejes un club grande desde un solo lugar.' },
      { titulo: 'Estadísticas de reservas', texto: 'Las mismas estadísticas del plan Estándar, con el volumen de datos propio de un club grande: más turnos, más clientes, más canchas para comparar entre sí.' },
      { titulo: 'Soporte prioritario', texto: 'Si tenés un problema con el sistema, tu consulta se atiende antes que las de los otros planes — porque sabemos que para un club grande, que la plataforma esté funcionando no es un detalle menor.' }
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
  const [enMora, setEnMora] = useState(false);
  const [clubDadoDeBaja, setClubDadoDeBaja] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tipoMensaje, setTipoMensaje] = useState('info');
  const [planAImprimir, setPlanAImprimir] = useState(null);
  const [verificandoCambioPlan, setVerificandoCambioPlan] = useState(false);
  // Guarda la función para cancelar el polling de "¿ya se aprobó el cambio
  // de plan?" que está corriendo, así nos aseguramos de pararlo si el
  // usuario se va de la pantalla (si no, sigue pegándole al backend cada
  // unos segundos por varios minutos sin que sirva de nada).
  const detenerVerificacionRef = useRef(null);

  useEffect(() => {
    return () => detenerVerificacionRef.current?.();
  }, []);

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
        const [resClub, resEstadoPago] = await Promise.all([
          apiFetch('/club/mi-club'),
          apiFetch('/club/estado-pago')
        ]);
        const data = await resClub.json();

        if (resClub.ok) {
          setClubId(data.id_club);
          setPlanActual(data.plan || 'basico');
        }

        if (resEstadoPago.ok) {
          const datosEstadoPago = await resEstadoPago.json();
          setEnMora(!!datosEstadoPago.en_mora);
          setClubDadoDeBaja(datosEstadoPago.motivo === 'baja');
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
    // Si ya había una verificación corriendo (ej. el usuario le dio varias
    // veces seguidas), la cancelamos antes de arrancar una nueva.
    detenerVerificacionRef.current?.();

    let cancelado = false;
    const planAlEmpezar = planActual;
    setVerificandoCambioPlan(true);
    setMensaje('Esperando el pago del nuevo plan...');
    setTipoMensaje('info');

    const consultar = async (intento) => {
      try {
        const res = await apiFetch(`/club/${idClub}/estado-cambio-plan`);

        if (!res.ok) throw new Error('Respuesta no OK del servidor');
        const data = await res.json();

        if (cancelado) return;

        if (data.estado === 'aprobado') {
          setPlanActual(data.plan);
          setMensaje(`Listo, ahora tenés el plan ${PLANES.find((p) => p.id === data.plan)?.nombre || data.plan}.`);
          setTipoMensaje('exito');
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        if (data.estado === 'rechazado') {
          setMensaje('El pago del nuevo plan no se completó. Podés intentarlo de nuevo.');
          setTipoMensaje('error');
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        if (data.estado === 'sin_cambio') {
          // "sin_cambio" puede ser que nunca hubo nada pendiente, o que el
          // webhook de Mercado Pago ya lo resolvió antes que nuestra propia
          // consulta (en ese caso el plan ya cambió de verdad, así que lo
          // mostramos como éxito en vez de "seguimos esperando").
          if (data.plan && data.plan !== planAlEmpezar) {
            setPlanActual(data.plan);
            setMensaje(`Listo, ahora tenés el plan ${PLANES.find((p) => p.id === data.plan)?.nombre || data.plan}.`);
            setTipoMensaje('exito');
          } else {
            setMensaje('Todavía estamos esperando la confirmación del pago. Volvé a esta página en unos minutos.');
            setTipoMensaje('info');
          }
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        if (intento >= INTENTOS_MAXIMOS_CAMBIO_PLAN) {
          setMensaje('Todavía estamos esperando la confirmación del pago. Volvé a esta página en unos minutos.');
          setTipoMensaje('info');
          setVerificandoCambioPlan(false);
          if (limpiarUrl) limpiarUrl();
          return;
        }

        setTimeout(() => consultar(intento + 1), ESPERA_ENTRE_INTENTOS_CAMBIO_PLAN_MS);

      } catch (err) {
        console.error('Error al consultar el cambio de plan:', err);
        if (!cancelado) {
          setMensaje('No pudimos confirmar el pago. Volvé a esta página en unos minutos.');
          setTipoMensaje('error');
          setVerificandoCambioPlan(false);
        }
      }
    };

    consultar(1);

    const detener = () => { cancelado = true; };
    detenerVerificacionRef.current = detener;
    return detener;
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
    // Si está en mora, dejamos "pagar" el mismo plan que ya tenía: es la
    // forma de generar una suscripción nueva y volver a estar al día.
    if (plan.id === planActual && !enMora) return;

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
        setTipoMensaje('error');
        setCambiando(false);
        return;
      }

      if (!data.init_point) {
        setMensaje('Los pagos no están disponibles en este momento. Contactanos para cambiar el plan.');
        setTipoMensaje('error');
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
      setTipoMensaje('error');
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

        {esClub && mensaje && <p className={`planes-mensaje planes-mensaje-${tipoMensaje}`}>{mensaje}</p>}

        {esClub && clubDadoDeBaja ? (
          <div className="planes-club-baja-aviso">
            <span className="planes-club-baja-icono">⚠️</span>
            <h3>Tu club fue dado de baja</h3>
            <p>Un administrador dio de baja tu club en la plataforma. Esto no se resuelve pagando un plan — escribinos para entender qué pasó y, si corresponde, reactivar tu cuenta.</p>
          </div>
        ) : (
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
                    disabled={(esElActual && !enMora) || cambiando || verificandoCambioPlan}
                  >
                    {esElActual
                      ? (enMora ? (cambiando ? 'Generando el pago...' : 'Pagar y regularizar') : 'Plan actual')
                      : (cambiando ? 'Generando el pago...' : 'Cambiar plan')}
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
        )}
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

          <p className="hoja-plan-descripcion">{planAImprimir.descripcionLarga}</p>

          <p className="hoja-plan-ideal-para">
            <strong>¿Para qué club es ideal?</strong> {planAImprimir.idealPara}
          </p>

          <h3 className="hoja-plan-subtitulo">¿Qué incluye este plan?</h3>
          <div className="hoja-plan-detalle-beneficios">
            {planAImprimir.detalleBeneficios.map((beneficio, i) => (
              <div className="hoja-plan-beneficio" key={i}>
                <p className="hoja-plan-beneficio-titulo">✓ {beneficio.titulo}</p>
                <p className="hoja-plan-beneficio-texto">{beneficio.texto}</p>
              </div>
            ))}
          </div>

          <p className="hoja-plan-fecha">
            Generado el {new Date().toLocaleDateString('es-AR')}
          </p>
        </div>
      )}
    </div>
  )
}

export default Planes