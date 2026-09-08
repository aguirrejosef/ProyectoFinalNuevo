// Compara nombres tipo "Cancha 2" vs "Cancha 10" tomando en cuenta el número,
// para que el orden sea 1, 2, 3... 10 y no alfabético ("10" antes que "2").
export function compararNatural(a = '', b = '') {
    const partesA = String(a).match(/\d+|\D+/g) || [];
    const partesB = String(b).match(/\d+|\D+/g) || [];

    const largo = Math.max(partesA.length, partesB.length);

    for (let i = 0; i < largo; i++) {
        const parteA = partesA[i] || '';
        const parteB = partesB[i] || '';

        const numA = Number(parteA);
        const numB = Number(parteB);

        if (!isNaN(numA) && !isNaN(numB) && parteA !== '' && parteB !== '') {
            if (numA !== numB) return numA - numB;
        } else if (parteA !== parteB) {
            return parteA.localeCompare(parteB);
        }
    }

    return 0;
}

export function ordenarCanchasPorNombre(canchas) {
    return [...canchas].sort((a, b) => compararNatural(a.nombre, b.nombre));
}
