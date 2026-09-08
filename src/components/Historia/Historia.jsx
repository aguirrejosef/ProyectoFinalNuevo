import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faLightbulb, faUsers, faCheck } from '@fortawesome/free-solid-svg-icons';
import Footer from '../Footer/Footer';
import NavBar from '../NavBar/NavBar';
import './Historia.css';

const valores = [
  {
    icono: faHeart,
    titulo: 'Pasión por el deporte',
    texto: 'Creemos en el poder transformador del pádel.'
  },
  {
    icono: faLightbulb,
    titulo: 'Innovación',
    texto: 'Apostamos por la tecnología para ofrecer soluciones prácticas.'
  },
  {
    icono: faUsers,
    titulo: 'Comunidad',
    texto: 'Creamos un espacio donde todos los amantes del pádel puedan disfrutar juntos.'
  }
];

const servicios = [
  'Página web para reservar y alquilar canchas de pádel.',
  'Torneos y eventos para todos los niveles.'
];

const Historia = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <NavBar />

      <div className="historia-encabezado">
        <h1>Sobre Nosotros</h1>
        <p>El origen de Sale un Pádel (SUP)</p>
      </div>

      <div className="historia-contenido">

        <div className="historia-intro">
          <img
            src="imagenes/padel.jpg"
            alt="Los fundadores de Sale un Pádel"
            className="historia-imagen"
          />
          <div className="historia-intro-texto">
            <p>
              SUP nació de la pasión compartida de cinco amigos por el pádel. Jose, Cristian y
              Facundo, tras años disfrutando juntos de este deporte, decidieron que era el momento
              de llevar su amor por el pádel un paso más allá. Con una visión clara y un propósito
              común, crearon un proyecto único que combina el deporte con la tecnología, el
              aprendizaje y la comunidad.
            </p>
            <p>
              Con la intención de resolver el problema de hoy en día donde todo es manual,
              decidieron crear una plataforma digital que facilitara la conexión entre los
              jugadores. Así nació "Sale un Pádel", una página web diseñada para permitir a los
              jugadores conectar, formar equipos y reservar fácilmente las canchas locales.
            </p>
          </div>
        </div>

        <div className="historia-mision">
          <h2>Nuestra misión</h2>
          <p>
            En Sale un Pádel, nuestra misión es proporcionar una experiencia de pádel completa,
            que va más allá del simple acto de jugar. Queremos fomentar la conexión entre
            jugadores, mejorar el acceso al deporte y fortalecer la comunidad.
          </p>
        </div>

        <div className="historia-seccion">
          <h2>Nuestros valores</h2>
          <div className="historia-valores-grid">
            {valores.map((valor) => (
              <div className="historia-valor-card" key={valor.titulo}>
                <div className="historia-valor-icono">
                  <FontAwesomeIcon icon={valor.icono} />
                </div>
                <h3>{valor.titulo}</h3>
                <p>{valor.texto}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="historia-seccion">
          <h2>Lo que ofrecemos</h2>
          <div className="historia-ofrecemos-grid">
            {servicios.map((servicio) => (
              <div className="historia-ofrecemos-item" key={servicio}>
                <span className="historia-ofrecemos-check">
                  <FontAwesomeIcon icon={faCheck} />
                </span>
                <span>{servicio}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="historia-compromiso">
          <h2>Nuestro compromiso</h2>
          <p>
            En Sale un Pádel estamos comprometidos a ofrecerte la mejor experiencia posible en
            cada aspecto del pádel. Únete a nuestra comunidad y forma parte de la evolución del
            pádel.
          </p>
          <button
            type="button"
            className="historia-boton-cta"
            onClick={() => navigate('/canchas')}
          >
            Ver clubes disponibles
          </button>
        </div>

      </div>

      <Footer />
    </div>
  );
};

export default Historia;
