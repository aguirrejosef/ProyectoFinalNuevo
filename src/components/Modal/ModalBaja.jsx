import React from 'react';
import './ModalBaja.css';

const ModalBaja = ({ show, onAccept, onCancel }) => {
    return (
        <div className={`modal ${show ? 'show' : ''}`}>
            <div className="modal-content">
                <p>¿Confirmar la baja?</p>
                <div className="modal-buttons">
                    <button className="modal-button accept" onClick={onAccept}>Aceptar</button>
                    <button className="modal-button cancel" onClick={onCancel}>Cancelar</button>
                </div>
            </div>
        </div>
    );
};

export default ModalBaja;
