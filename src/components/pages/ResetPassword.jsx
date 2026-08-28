import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import NavBar from '../NavBar/NavBar'
import BtnFlotanteWp from '../Button/BtnFlotanteWp/BtnFlotanteWp'
import Footer from '../Footer/Footer'
import './RecPassword.css'
import { apiFetch } from '../../api'
 
function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
 
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [exito, setExito] = useState(false)
 
  useEffect(() => {
    if (!token) {
      setMensaje('Enlace inválido.')
    }
  }, [token])
 
  const handleSubmit = async (e) => {
    e.preventDefault()
    setMensaje('')
 
    if (password !== confirmar) {
      setMensaje('Las contraseñas no coinciden')
      return
    }
 
    if (password.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres')
      return
    }
 
    setEnviando(true)
 
    try {
      const res = await apiFetch('/usuarios/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password })
      })
 
      const data = await res.json()
 
      if (res.ok) {
        setExito(true)
        setMensaje('Contraseña actualizada correctamente. Ya podés iniciar sesión.')
        setTimeout(() => navigate('/login'), 3000)
      } else {
        setMensaje(data.message || 'No se pudo actualizar la contraseña')
      }
    } catch (error) {
      console.error('Error al resetear contraseña:', error)
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
          <h2>Restablecer contraseña</h2>
 
          {!exito && token && (
            <form onSubmit={handleSubmit}>
              <input
                type="password"
                placeholder="Nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Confirmar contraseña"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
              <button type="submit" disabled={enviando}>
                {enviando ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
 
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
 
export default ResetPassword
