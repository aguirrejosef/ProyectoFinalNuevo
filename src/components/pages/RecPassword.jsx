import React, { useState } from 'react'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import Footer from '../Footer/Footer'
import './RecPassword.css'
 
function RecPassword() {
  const [correo, setCorreo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
    setEnviando(true)
 
    try {
      const res = await fetch('http://localhost:3000/usuarios/solicitar-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo })
      })
 
      const data = await res.json()
      setMensaje(data.message || 'Si el correo existe, te enviamos un enlace de recuperación.')
    } catch (error) {
      console.error('Error al solicitar recuperación:', error)
      setMensaje('Ocurrió un error, intentá nuevamente más tarde.')
    } finally {
      setEnviando(false)
    }
  }
 
  return (
    <div>
      <NavBar/>
 
      <div className="recpassword-contenedor">
        <div className="recpassword-card">
          <h2>Recuperar acceso</h2>
          <p>Ingresá el correo con el que te registraste. Te vamos a enviar tu nombre de usuario y un enlace para restablecer tu contraseña.</p>
 
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Tu correo"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
            />
 
            <button type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>
          </form>
 
          {mensaje && <p className="recpassword-mensaje">{mensaje}</p>}
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
 
export default RecPassword
 