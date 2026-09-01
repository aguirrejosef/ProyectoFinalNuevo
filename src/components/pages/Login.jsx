
import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import '../pages/Login.css';
import logo from '../../imagenes/logo.png';
import { apiFetch } from '../../api';
import { perfilCompletoDesdeLocalStorage } from '../../utils/perfilCompleto';

function Login() {
    const navigate = useNavigate();

    const [correo, setCorreo] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleRecuperarPassword = () =>
        window.location.href = '/recuperar-password';

    // ==========================================
    // LOGIN MANUAL
    // ==========================================

    const handleLoginManual = async () => {
    if (!correo || !password) {
        setErrorMessage('Por favor ingresa tu usuario y contraseña');
        return;
    }

    setLoading(true);

    try {
        const response = await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({ usuario: correo, password: password })
        });

        const data = await response.json();

        if (!response.ok) {
            setErrorMessage(data.message || 'Error desconocido');
            return;
        }

            localStorage.setItem('token', data.token);
            localStorage.setItem('id', data.id);
            localStorage.setItem('usuario', data.usuario || '');
            localStorage.setItem('nombre', data.nombre || '');
            localStorage.setItem('apellido', data.apellido || '');
            localStorage.setItem('dni', data.dni || '');
            localStorage.setItem('correo', data.correo || '');
            localStorage.setItem('telefono', data.telefono || '');
            localStorage.setItem('foto', data.foto || '');
            localStorage.setItem('rol', data.rol);

            if (data.rol === 1) {
            window.location.href = '/admin';
                } else if (data.rol === 2) {
            window.location.href = '/club';
                } else {
            window.location.href = '/';
                }

    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        setErrorMessage('Error al conectar con el servidor');
    } finally {
        setLoading(false);
    }
};


    // ==========================================
    // LOGIN CON GOOGLE
    // ==========================================

    const handleGoogleLogin = async (credentialResponse) => {

    if (!credentialResponse || !credentialResponse.credential) {
        return;
    }

    setLoading(true);

    try {

        // ------------------------------------------
        // ENVIAR CREDENCIAL AL BACKEND
        // ------------------------------------------

        const res = await apiFetch(
            '/usuarios/login-google',
            {
                method: 'POST',
                body: JSON.stringify({
                    credential: credentialResponse.credential
                })
            }
        );

        const data = await res.json();

        // ------------------------------------------
        // LOGIN CORRECTO
        // ------------------------------------------

        if (res.ok) {

            console.log('Login Google:', data);

            localStorage.setItem('token', data.token);
            localStorage.setItem('id', data.id);
            localStorage.setItem('usuario', data.usuario || '');
            localStorage.setItem('nombre', data.nombre || '');
            localStorage.setItem('apellido', data.apellido || '');
            localStorage.setItem('dni', data.dni || '');
            localStorage.setItem('correo', data.correo || '');
            localStorage.setItem('telefono', data.telefono || '');
            localStorage.setItem('foto', data.foto || '');
            localStorage.setItem('rol', data.rol);

            // ------------------------------------------
            // REDIRECCIÓN SEGÚN ROL
            // ------------------------------------------

            if (data.rol === 1) {
            navigate('/admin');
            } else if (data.rol === 2) {
            navigate('/canchas');
            } else if (data.rol === 3 && !perfilCompletoDesdeLocalStorage()) {
            alert('Te faltan completar algunos datos de tu perfil (apellido, DNI y/o teléfono). Completalos para poder reservar turnos.');
            navigate('/mi-perfil');
            } else {
            navigate('/');
            }

        } else {
            setErrorMessage(data.message || 'Error login con Google');
        }

    } catch (error) {
        console.error('Error login Google:', error);
        setErrorMessage('Error al conectar con Google');

    } finally {
        setLoading(false);
    }
};


    // ==========================================
    // RETURN
    // ==========================================

    return (
        <GoogleOAuthProvider
            clientId="852264110344-fgjqpscj6v4s4eg6tvchaii2ctiapoh0.apps.googleusercontent.com"
        >

            <div id="contenedor-login">

                <div className="grid-login">

                    <div className="grid-item-login">

                        <img src={logo} alt="SUP - Sale un Padel" className="logo-login" />

                       <h2 className="titulo-login">
    Iniciar sesión
</h2>


{/* LOGIN MANUAL */}

<div className="formulario-negocio">

    <input
        type="text"
        placeholder="Usuario o correo"
        value={correo}
        onChange={(e) => setCorreo(e.target.value)}
    />

    <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
    />

    <button
        type="button"
        onClick={handleLoginManual}
        disabled={loading}
        className="btn-iniciar-sesion-usuario"
    >
        {loading ? 'Ingresando...' : 'Iniciar sesión'}
    </button>

</div>


{/* RECUPERAR CONTRASEÑA */}

<p
    className="recuperar-password-negocio"
    onClick={handleRecuperarPassword}
>
    ¿Olvidaste tu contraseña?
</p>


{/* SEPARADOR */}

<p className="separador-login">o</p>


{/* LOGIN CON GOOGLE */}

<div className="contenedor-google-login">
    <GoogleLogin
        onSuccess={handleGoogleLogin}

        onError={() =>
            setErrorMessage(
                'Error en login de Google'
            )
        }
    />
</div>


{/* BOTÓN INSCRIBIRME */}

<button
    type="button"
    onClick={() => navigate('/registro-usuario')}
    className="btn-inscribirme"
>
    Inscribirme
</button>

                        {/* MENSAJE DE ERROR */}

                        {errorMessage && (
                            <p
                                style={{
                                    color: 'red',
                                    marginTop: '15px'
                                }}
                            >
                                {errorMessage}
                            </p>
                        )}

                    </div>

                </div>

            </div>

        </GoogleOAuthProvider>
    );
}

export default Login;

