export const API_URL = 'http://localhost:3000';

export function getToken() {
  return localStorage.getItem('token');
}

export function cerrarSesion() {
  localStorage.clear();
  window.location.href = '/login';
}

// Wrapper de fetch que agrega automáticamente el token de sesión (JWT)
// y la base de la API. Usar siempre que se llame al backend.
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const esFormData = options.body instanceof FormData;

  const headers = {
    ...(!esFormData && options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
