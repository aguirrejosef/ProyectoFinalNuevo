import React, { useState } from 'react';
import './CardAdminClub.css';
import ModalBaja from '../Modal/ModalBaja';

const ClubCard = ({ club }) => {
    const [showModal, setShowModal] = useState(false);

    const handleBajaClick = () => {
        setShowModal(true); // Mostrar el modal al hacer clic en "Dar de Baja"
    };

    const handleAccept = async () => {
        try {
            const response = await fetch(`http://localhost:5000/registro/clubs/${club._id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.ok) {
                alert('Club eliminado correctamente');
                // Aquí podrías actualizar la interfaz o realizar alguna acción adicional después de la eliminación
            } else {
                throw new Error('Error al eliminar el club');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al intentar eliminar el club');
        } finally {
            setShowModal(false); // Ocultar el modal después de la acción (ya sea éxito o error)
        }
    };

    const handleCancel = () => {
        setShowModal(false); // Ocultar el modal si el usuario cancela la acción
    };

    const handleClick = () => {
        alert("Historial de reservas");
    };

    return (
        <div className="club-card">
            <div className="card-header">
                <strong>{club.nombreClub}</strong>
            </div>
            <div className="grid-info-card-negocio">
                <div className="card-negocio-admin">
                    <p id='admin-info-negocio'><strong>Nombre del Titular:</strong> {club.nombreTitular}</p>
                    <p><strong>Número del Titular:</strong> {club.nroTitular}</p>
                    <p><strong>Edad:</strong> {club.edad}</p>
                    <p><strong>Número del Club:</strong> {club.nroClub}</p>
                    <p><strong>Localidad:</strong> {club.localidad}</p>
                </div>
                <div className="card-negocio-admin">
                    <p><strong>Dirección:</strong> {club.direccion}</p>
                    <p><strong>Correo:</strong> {club.correo}</p>
                    <p><strong>Usuario:</strong> {club.usuario}</p>
                    <p><strong>Password:</strong> {club.password}</p>
                    <p><strong>Canchas:</strong> {club.canchas}</p>
                </div>
            </div>
            <div className="card-footer">
                <p><strong>Fecha de registro:</strong> {new Date(club.date).toLocaleDateString()}</p>
            </div>
            <div className="grid-btn-card-negocio">
                <button className="btn-card-negocio" id='btn-negocio-baja' onClick={handleBajaClick}><strong>Dar de Baja</strong></button>
                <button className="btn-card-negocio" id='btn-negocio-reserva' onClick={handleClick}><strong>Ver Historial de Reservas</strong></button>
                <button className="btn-card-negocio" id='btn-negocio-editar'><strong>Editar</strong></button>
            </div>

            {/* Modal para confirmación de baja */}
            {showModal && (
                <ModalBaja show={showModal} onAccept={handleAccept} onCancel={handleCancel} />
            )}
        </div>
    );
};

export default ClubCard;
