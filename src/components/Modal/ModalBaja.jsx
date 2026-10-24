import React, { useState } from 'react';
import './ModalBaja.css';

const ModalBaja = ({ show, onAccept, onCancel, mensaje, pedirMotivo, procesando }) => {
    const [motivo, setMotivo] = useState('');

    const handleAceptar = () => {
        onAccept(pedirMotivo ? motivo.trim() : undefined);
    };

    return (
        <div className={`modal-baja ${show ? 'show' : ''}`}>
            <div className="modal-content">
                <p>{mensaje || '¿Confirmar la baja?'}</p>

                {pedirMotivo && (
                    <label className="modal-baja-label-motivo">
                        Motivo de la baja (se lo vamos a informar al dueño del club)
                        <textarea
                            className="modal-baja-motivo"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Ej: falta de pago reiterada, incumplimiento de normas, pedido del propio club, etc."
                            rows={4}
                        />
                    </label>
                )}

                <div className="modal-buttons">
                    <button
                        className="modal-button accept"
                        onClick={handleAceptar}
                        disabled={procesando || (pedirMotivo && !motivo.trim())}
                    >
                        {procesando ? 'Procesando...' : 'Aceptar'}
                    </button>
                    <button className="modal-button cancel" onClick={onCancel} disabled={procesando}>Cancelar</button>
                </div>
            </div>
        </div>
    );
};

export default ModalBaja;
