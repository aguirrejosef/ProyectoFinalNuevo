import React from 'react';
import Footer from '../Footer/Footer';
import NavBar from '../NavBar/NavBar';
import './Historia.css';

const Historia = () => {
  return (
    <div className="page-container">
      {/* Barra de Navegación */}
      <NavBar />

      {/* Sección de Imagen e Historia */}
      <div className="history-section">
        <img 
          src="imagenes/padel.jpg" 
          alt="Ejemplo" 
          className="history-image"
        />
        <div className="history-text">
          <h2>Sobre Nosotros: El Origen de Sale Un Pádel (SUP)</h2>
          <p>
            SUP nació de la pasión compartida de cinco amigos por el pádel. Jose, Cristian, 
            Facundo, tras años disfrutando juntos de este deporte, 
            decidieron que era el momento de llevar su amor por el pádel un paso más allá. 
            Con una visión clara y un propósito común, crearon un proyecto único que combina 
            el deporte con la tecnología, el aprendizaje y la comunidad.
          </p>
          <p>
            Con la intención de resolver el problema de hoy en día donde todo es manual, 
            decidieron crear una plataforma digital que facilitara la conexión entre los jugadores. 
            Así nació "Sale un Pádel", una página web diseñada para permitir a los jugadores conectar, 
            formar equipos y reservar fácilmente las canchas locales. 
          </p>
          
          <h3>Nuestra Misión</h3>
          <p>
            En Sale un Pádel, nuestra misión es proporcionar una experiencia de pádel completa, 
            que va más allá del simple acto de jugar. Queremos fomentar la conexión entre jugadores, 
            mejorar el acceso al deporte y fortalecer la comunidad.
          </p>

          <h3>Nuestros Valores</h3>
          <ul>
            <li><b>Pasión por el deporte:</b> Creemos en el poder transformador del pádel.</li>
            <li><b>Innovación:</b> Apostamos por la tecnología para ofrecer soluciones prácticas.</li>
            <li><b>Comunidad:</b> Creamos un espacio donde todos los amantes del pádel puedan disfrutar juntos.</li>
          </ul>

          <h3>Lo que Ofrecemos</h3>
          <ul>
            <li>Página web para reservar y alquilar canchas de pádel.</li>
            <li>Torneos y eventos para todos los niveles.</li>
          </ul>

          <h3>Nuestro Compromiso</h3>
          <p>
            En Sale un Pádel estamos comprometidos a ofrecerte la mejor experiencia posible en cada aspecto 
            del pádel. Únete a nuestra comunidad y forma parte de la evolución del pádel.
          </p>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Historia;
