import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CardAdminClub.css';
import ModalBaja from '../Modal/ModalBaja';
import { apiFetch } from '../../api';

const ETIQUETA_ESTADO = {
    activa: { texto: 'Al día', clase: 'badge-suscripcion-activa' },
    pausada: { texto: 'Pausada', clase: 'badge-suscripcion-pausada' },
    cancelada: { texto: 'Cancelada', clase: 'badge-suscripcion-cancelada' }
};

const formatearFecha = (fecha) => {
    if (!fecha) return null;
    return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const ClubCard = ({ club, onEliminado }) => {
    const navigate = useNavigate();
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

    const estado = ETIQUETA_ESTADO[club.estado_suscripcion] || null;
    const proximoPago = formatearFecha(club.proxima_fecha_pago);

    return (
        <div className="club-card">
            <div className="card-header">
                <strong>{club.nombre}</strong>
                {estado && <span className={`badge-suscripcion ${estado.clase}`}>{estado.texto}</span>}
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
                    <p><strong>Próximo pago:</strong> {proximoPago || '-'}</p>
                    <p><strong>Canchas:</strong> {club.cantidad_canchas ?? 0}</p>
                </div>
            </div>
            <div className="grid-btn-card-negocio">
                <button
                    className="btn-card-negocio"
                    id='btn-negocio-detalle'
                    onClick={() => navigate(`/admin/clubes/${club.id_club}`)}
                >
                    <strong>Ver detalles</strong>
                </button>
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
