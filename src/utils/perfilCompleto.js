// Datos personales que le pedimos a un cliente antes de dejarlo reservar.
// Google solo nos da nombre/correo/foto, así que apellido/DNI/teléfono
// suelen quedar vacíos hasta que la persona los completa a mano.
export function perfilCompletoDesdeLocalStorage() {
    const nombre = localStorage.getItem('nombre');
    const apellido = localStorage.getItem('apellido');
    const dni = localStorage.getItem('dni');
    const telefono = localStorage.getItem('telefono');
    return !!(nombre && apellido && dni && telefono);
}
