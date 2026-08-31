import {
    faWifi,
    faSquareParking,
    faShirt,
    faCakeCandles,
    faDumbbell,
    faKitMedical,
    faFire,
    faUtensils,
    faTrophy,
    faUmbrellaBeach,
    faPersonSwimming,
    faCartShopping,
    faTableTennisPaddleBall,
    faSchool,
    faCheck
} from '@fortawesome/free-solid-svg-icons';

// Ícono aproximado según el nombre del servicio (texto libre cargado por el club)
export function iconoServicio(nombre) {
    const texto = (nombre || '').toLowerCase();
    if (texto.includes('wifi')) return faWifi;
    if (texto.includes('estacionamiento')) return faSquareParking;
    if (texto.includes('vestuario')) return faShirt;
    if (texto.includes('cumplea')) return faCakeCandles;
    if (texto.includes('gimnasio')) return faDumbbell;
    if (texto.includes('medic')) return faKitMedical;
    if (texto.includes('escuel')) return faSchool;
    if (texto.includes('torneo')) return faTrophy;
    if (texto.includes('parrilla')) return faFire;
    if (texto.includes('bar') || texto.includes('restaur')) return faUtensils;
    if (texto.includes('quincho')) return faUmbrellaBeach;
    if (texto.includes('paleta')) return faTableTennisPaddleBall;
    if (texto.includes('pileta') || texto.includes('pool') || texto.includes('nata')) return faPersonSwimming;
    if (texto.includes('buffet') || texto.includes('kiosco')) return faCartShopping;
    return faCheck;
}
