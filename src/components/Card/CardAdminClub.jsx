import React, { useState } from 'react';
import './CardAdminClub.css';
import ModalBaja from '../Modal/ModalBaja';
import { apiFetch } from '../../api';

const ClubCard = ({ club, onEliminado }) => {
    const [showModal, setShowModal] = useState(false);
    const [eliminando, setEliminando] = useState(false);

    const handleBajaClick = () => {
        setShowModal(true);
    };

    const handleAccept = async () => {
        setEliminando(true);
        try {
            const response = await apiFetch(`/clubes/${club.id_club}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                onEliminado(club.id_club);
            } else {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'Error al eliminar el club');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Ocurrió un error al intentar eliminar el club');
        } finally {
            setEliminando(false);
            setShowModal(false);
        }
    };

    const handleCancel = () => {
        setShowModal(false);
    };

    return (
        <div className="club-card">
            <div className="card-header">
                <strong>{club.nombre}</strong>
            </div>
            <div className="grid-info-card-negocio">
                <div className="card-negocio-admin">
                    <p id='admin-info-negocio'><strong>Dueño:</strong> {club.dueno || '-'}</p>
                    <p><strong>Teléfono:</strong> {club.telefono || '-'}</p>
                    <p><strong>Provincia:</strong> {club.provincia || '-'}</p>
                    <p><strong>Localidad:</strong> {club.localidad || '-'}</p>
                </div>
                <div className="card-negocio-admin">
                    <p><strong>Dirección:</strong> {club.direccion || '-'}</p>
                    <p><strong>Plan:</strong> {club.plan || '-'}</p>
                    <p><strong>Canchas:</strong> {club.cantidad_canchas ?? 0}</p>
                    <p><strong>Precio desde:</strong> {club.precio_desde ? `$${club.precio_desde}` : '-'}</p>
                </div>
            </div>
            <div className="grid-btn-card-negocio">
                <button
                    className="btn-card-negocio"
                    id='btn-negocio-baja'
                    onClick={handleBajaClick}
                    disabled={eliminando}
                >
                    <strong>{eliminando ? 'Eliminando...' : 'Dar de Baja'}</strong>
                </button>
            </div>

            {showModal && (
                <ModalBaja show={showModal} onAccept={handleAccept} onCancel={handleCancel} />
            )}
        </div>
    );
};

export default ClubCard;
