import React, { useEffect, useRef } from 'react';
import './Toast.css';

const DURACION_MS = 5000;

function Toast({ mensaje, tipo = 'exito', onCerrar }) {
    // Guardamos la última versión de onCerrar en un ref para no depender de
    // ella en el useEffect: si dependiera de onCerrar directo, el timer se
    // reiniciaría en cada repintado del padre (onCerrar suele ser una
    // función nueva cada vez), y el toast podría no cerrarse nunca solo.
    const onCerrarRef = useRef(onCerrar);
    onCerrarRef.current = onCerrar;

    useEffect(() => {
        if (!mensaje) return undefined;
        const timer = setTimeout(() => onCerrarRef.current(), DURACION_MS);
        return () => clearTimeout(timer);
    }, [mensaje]);

    if (!mensaje) return null;

    return (
        <div className={`toast toast-${tipo}`} role="status">
            <span className="toast-icono">{tipo === 'error' ? '✕' : '✓'}</span>
            <p className="toast-mensaje">{mensaje}</p>
            <button type="button" className="toast-cerrar" onClick={onCerrar} aria-label="Cerrar aviso">×</button>
        </div>
    );
}

export default Toast;
