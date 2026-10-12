const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
require('dotenv').config();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const app = express();
const port = 3000;
const multer = require('multer');
const path = require('path');
const { MercadoPagoConfig, Preference, Payment, PreApproval, Invoice } = require('mercadopago');
const ExcelJS = require('exceljs');

if (!process.env.JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env');
}

app.use(cors());
app.use(express.json());
const storageCanchas = multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'uploads/canchas');
        },
        filename: (req, file, cb) => {
          const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          cb(null, nombreUnico);
        }
      });
      const uploadCancha = multer({ storage: storageCanchas });
 
      // Sirve las imágenes guardadas como archivos estáticos
      app.use('/uploads', express.static('uploads'));

// Pool de MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'padel',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ------------------ Autenticación / Autorización ------------------
function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Falta el token de autenticación' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!rolesPermitidos.includes(Number(req.usuario.rol))) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    next();
  };
}

// Verifica que el club :id (o el club dueño de :id_club recibido en query/body)
// pertenezca al usuario autenticado, salvo que sea admin.
async function verificarDuenoDeClub(req, idClub) {
  if (Number(req.usuario.rol) === 1) return true; // admin
  const [rows] = await pool.execute('SELECT id_dueno FROM club WHERE id_club = ?', [idClub]);
  return rows.length > 0 && rows[0].id_dueno === req.usuario.id;
}

// Igual que verificarDuenoDeClub, pero a partir del id de una cancha.
async function verificarDuenoDeCancha(req, idCancha) {
  if (Number(req.usuario.rol) === 1) return true; // admin
  const [rows] = await pool.execute(
    'SELECT cl.id_dueno FROM canchas c INNER JOIN club cl ON c.id_club = cl.id_club WHERE c.id_cancha = ?',
    [idCancha]
  );
  return rows.length > 0 && rows[0].id_dueno === req.usuario.id;
}

// ------------------ Pagos (Mercado Pago) ------------------
const PORCENTAJE_SENA = 0.5;
const ID_METODO_MERCADOPAGO = 4;
// Mercado Pago rechaza auto_return, y exige un back_url válido, si
// FRONTEND_URL no es una URL pública (por ej. localhost en desarrollo).
// Mientras se prueba en local (sin dominio propio todavía) usamos esta URL
// de relleno para las suscripciones, que sí o sí piden un back_url; el
// pago funciona igual, solo que no hay link automático de vuelta al sitio.
// El día que haya un dominio real (FRONTEND_URL en https), se usa solo.
const FRONTEND_URL_ES_PUBLICA = /^https:\/\//.test(process.env.FRONTEND_URL || '');
const BACK_URL_RELLENO = 'https://www.mercadopago.com.ar';
// Minutos que se sostiene una reserva mientras el cliente paga la seña.
// Pasado ese tiempo sin pago aprobado, el horario vuelve a estar libre.
const MINUTOS_ESPERA_PAGO = 10;

const mpClient = process.env.MP_ACCESS_TOKEN
  ? new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN })
  : null;

// ------------------ Suscripción de planes del club ------------------
const PRECIOS_PLANES = {
  basico: 50000,
  estandar: 80000,
  premium: 120000
};

// Da de alta de verdad al club (usuario dueño + club + canchas) una vez que
// Mercado Pago confirmó que la suscripción del plan quedó autorizada.
async function registrarClubDesdePendiente(pendiente, proximaFechaPago) {
  const hashedPassword = pendiente.password_hash;

  const [userResult] = await pool.execute(
    'INSERT INTO usuarios (usuario, correo, password, metodo_registro, id_rol) VALUES (?, ?, ?, ?, ?)',
    [pendiente.usuario, pendiente.correo, hashedPassword, 'manual', 2]
  );
  const idUsuario = userResult.insertId;

  const [clubResult] = await pool.execute(
    `INSERT INTO club (nombre, direccion, provincia, localidad, telefono, id_dueno, plan, mp_preapproval_id, estado_suscripcion, proxima_fecha_pago)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'activa', ?)`,
    [pendiente.nombre_club, pendiente.direccion, pendiente.provincia, pendiente.localidad, pendiente.nro_titular, idUsuario, pendiente.plan, pendiente.mp_preapproval_id, proximaFechaPago || null]
  );
  const idClub = clubResult.insertId;

  for (let i = 1; i <= pendiente.canchas; i++) {
    await pool.execute(
      'INSERT INTO canchas (nombre, estado, id_club) VALUES (?, ?, ?)',
      [`Cancha ${i}`, 'disponible', idClub]
    );
  }

  return idClub;
}

// Consulta a Mercado Pago el estado real de la suscripción de un registro
// pendiente y, si ya está autorizada, recién ahí crea el club de verdad.
// La llaman tanto el webhook de MP como la pantalla a la que vuelve el
// dueño del club después de autorizar el pago.
async function sincronizarRegistroClubPendiente(idRegistro) {
  if (!mpClient) {
    return { estado: 'error', message: 'Los pagos no están configurados en el servidor' };
  }

  const [rows] = await pool.execute('SELECT * FROM registros_club_pendientes WHERE id_registro = ?', [idRegistro]);
  if (rows.length === 0) {
    return { estado: 'no_encontrado' };
  }

  const pendiente = rows[0];

  if (pendiente.estado === 'aprobado') {
    return { estado: 'aprobado' };
  }
  if (pendiente.estado === 'rechazado') {
    return { estado: 'rechazado' };
  }
  if (!pendiente.mp_preapproval_id) {
    return { estado: 'pendiente' };
  }

  const preapprovalClient = new PreApproval(mpClient);
  const preapproval = await preapprovalClient.get({ id: pendiente.mp_preapproval_id });

  if (preapproval.status === 'authorized') {
    const proximaFechaPago = preapproval.next_payment_date
      ? preapproval.next_payment_date.slice(0, 10)
      : null;
    await registrarClubDesdePendiente(pendiente, proximaFechaPago);
    await pool.execute("UPDATE registros_club_pendientes SET estado = 'aprobado' WHERE id_registro = ?", [idRegistro]);
    return { estado: 'aprobado' };
  }

  if (['cancelled', 'rejected'].includes(preapproval.status)) {
    await pool.execute("UPDATE registros_club_pendientes SET estado = 'rechazado' WHERE id_registro = ?", [idRegistro]);
    return { estado: 'rechazado' };
  }

  return { estado: 'pendiente' };
}

// Consulta a Mercado Pago el estado real de un cambio de plan pendiente de
// un club ya activo y, si ya está autorizado, recién ahí aplica el nuevo
// plan (y cancela la suscripción del plan anterior para no cobrar las dos).
// La llaman tanto el webhook de MP como la pantalla de planes cuando el
// dueño del club vuelve de autorizar el pago.
async function sincronizarCambioPlanClub(idClub) {
  if (!mpClient) {
    return { estado: 'error', message: 'Los pagos no están configurados en el servidor' };
  }

  const [rows] = await pool.execute('SELECT * FROM club WHERE id_club = ?', [idClub]);
  if (rows.length === 0) {
    return { estado: 'no_encontrado' };
  }

  const club = rows[0];

  if (!club.mp_preapproval_pendiente_id) {
    return { estado: 'sin_cambio', plan: club.plan };
  }

  const preapprovalClient = new PreApproval(mpClient);
  const preapproval = await preapprovalClient.get({ id: club.mp_preapproval_pendiente_id });

  if (preapproval.status === 'authorized') {
    const proximaFechaPago = preapproval.next_payment_date
      ? preapproval.next_payment_date.slice(0, 10)
      : null;

    // Cancelamos la suscripción del plan anterior para no cobrar las dos a la vez.
    // Best-effort: si ya estaba cancelada o falla, igual seguimos con el cambio.
    if (club.mp_preapproval_id && club.mp_preapproval_id !== club.mp_preapproval_pendiente_id) {
      try {
        await preapprovalClient.update({ id: club.mp_preapproval_id, body: { status: 'cancelled' } });
      } catch (error) {
        console.error('No se pudo cancelar la suscripción anterior:', error);
      }
    }

    await pool.execute(
      `UPDATE club
       SET plan = ?, mp_preapproval_id = ?, plan_pendiente = NULL, mp_preapproval_pendiente_id = NULL,
           estado_suscripcion = 'activa', proxima_fecha_pago = ?
       WHERE id_club = ?`,
      [club.plan_pendiente, club.mp_preapproval_pendiente_id, proximaFechaPago, idClub]
    );

    return { estado: 'aprobado', plan: club.plan_pendiente };
  }

  if (['cancelled', 'rejected'].includes(preapproval.status)) {
    await pool.execute(
      'UPDATE club SET plan_pendiente = NULL, mp_preapproval_pendiente_id = NULL WHERE id_club = ?',
      [idClub]
    );
    return { estado: 'rechazado', plan: club.plan };
  }

  return { estado: 'pendiente', plan: club.plan };
}

// Consulta a Mercado Pago el estado real del pago de un turno (por external_reference)
// y sincroniza turnos/pagos según corresponda. La llaman tanto el webhook de MP
// como la pantalla a la que vuelve el cliente después de pagar.
async function sincronizarPagoDeTurno(idTurno) {
  if (!mpClient) {
    return { estado: 'error', message: 'Los pagos no están configurados en el servidor' };
  }

  const [pagoRows] = await pool.execute('SELECT estado FROM pagos WHERE id_turno = ?', [idTurno]);
  if (pagoRows.length === 0) {
    return { estado: 'sin_pago' };
  }
  if (pagoRows[0].estado === 'pagado') {
    return { estado: 'pagado' };
  }

  const paymentClient = new Payment(mpClient);
  const busqueda = await paymentClient.search({ options: { external_reference: String(idTurno) } });
  const pagosEncontrados = busqueda.results || [];

  if (pagosEncontrados.length === 0) {
    return { estado: 'pendiente' };
  }

  const ultimoPago = pagosEncontrados.sort(
    (a, b) => new Date(b.date_created) - new Date(a.date_created)
  )[0];

  if (ultimoPago.status === 'approved') {
    await pool.execute('UPDATE pagos SET estado = ? WHERE id_turno = ?', ['pagado', idTurno]);
    await pool.execute(
      `UPDATE turnos SET id_estado = (SELECT id_estado FROM estados_turno WHERE nombre = 'reservado') WHERE id_turno = ?`,
      [idTurno]
    );
    return { estado: 'pagado' };
  }

  if (['rejected', 'cancelled'].includes(ultimoPago.status)) {
    await pool.execute('DELETE FROM pagos WHERE id_turno = ?', [idTurno]);
    await pool.execute(
      `UPDATE turnos SET id_estado = (SELECT id_estado FROM estados_turno WHERE nombre = 'cancelado') WHERE id_turno = ?`,
      [idTurno]
    );
    return { estado: 'rechazado' };
  }

  return { estado: 'pendiente' };
}
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }

});

// Le avisa por mail al cliente que su turno fue cancelado por el club, con el motivo.
async function enviarEmailCancelacionTurno(turno, motivo) {
  const fecha = new Date(turno.fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const horaInicio = String(turno.hora_inicio).slice(0, 5);
  const horaFin = String(turno.hora_fin).slice(0, 5);

  await transporter.sendMail({
    from: `"${turno.nombre_club}" <${process.env.EMAIL_USER}>`,
    to: turno.correo_cliente,
    subject: `Tu turno en ${turno.nombre_club} fue cancelado`,
    html: `
      <p>Hola ${turno.nombre_cliente || ''},</p>
      <p>Te informamos que <b>${turno.nombre_club}</b> canceló tu turno:</p>
      <ul>
        <li><b>Cancha:</b> ${turno.nombre_cancha}</li>
        <li><b>Fecha:</b> ${fecha}</li>
        <li><b>Horario:</b> ${horaInicio} a ${horaFin} hs</li>
      </ul>
      <p><b>Motivo:</b> ${motivo}</p>
      <p>Podés reservar un nuevo turno cuando quieras desde la plataforma.</p>
    `
  });
}

// Le avisa por mail al dueño del club que un administrador dio de baja su
// club, con el motivo. Así no se entera recién cuando intenta entrar.
async function enviarEmailBajaClub(nombreClub, nombreDueno, correoDueno, motivo) {
  await transporter.sendMail({
    from: `"SUP - Sale un Pádel" <${process.env.EMAIL_USER}>`,
    to: correoDueno,
    subject: `Tu club ${nombreClub} fue dado de baja`,
    html: `
      <p>Hola ${nombreDueno || ''},</p>
      <p>Te informamos que un administrador de SUP - Sale un Pádel dio de baja a <b>${nombreClub}</b> en la plataforma.</p>
      <p><b>Motivo:</b> ${motivo}</p>
      <p>Mientras tanto, tu club deja de aparecer en las búsquedas públicas y no vas a poder gestionarlo desde tu panel.
      Si creés que se trata de un error o querés más información, escribinos para resolverlo.</p>
    `
  });
}

// Le recuerda por mail al cliente que mañana tiene un turno reservado.
async function enviarEmailRecordatorioTurno(turno) {
  const fecha = new Date(turno.fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const horaInicio = String(turno.hora_inicio).slice(0, 5);
  const horaFin = String(turno.hora_fin).slice(0, 5);

  await transporter.sendMail({
    from: `"${turno.nombre_club}" <${process.env.EMAIL_USER}>`,
    to: turno.correo_cliente,
    subject: `Recordatorio: tu turno en ${turno.nombre_club} es mañana`,
    html: `
      <p>Hola ${turno.nombre_cliente || ''},</p>
      <p>Te recordamos que mañana tenés un turno reservado:</p>
      <ul>
        <li><b>Club:</b> ${turno.nombre_club}</li>
        <li><b>Cancha:</b> ${turno.nombre_cancha}</li>
        <li><b>Fecha:</b> ${fecha}</li>
        <li><b>Horario:</b> ${horaInicio} a ${horaFin} hs</li>
      </ul>
      <p>¡Te esperamos!</p>
    `
  });
}

// Busca turnos reservados para mañana que todavía no tengan el recordatorio
// enviado, manda el mail y los marca (así no se repite en la próxima
// corrida). Se llama al arrancar el servidor y después una vez por hora.
async function revisarRecordatoriosTurnos() {
  try {
    const [turnos] = await pool.execute(
      `SELECT
          t.id_turno, t.fecha,
          h.hora_inicio, h.hora_fin,
          c.nombre AS nombre_cancha, cl.nombre AS nombre_club,
          u.correo AS correo_cliente, u.nombre AS nombre_cliente
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE et.nombre = 'reservado'
         AND t.recordatorio_enviado = 0
         AND t.fecha = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );

    for (const turno of turnos) {
      if (turno.correo_cliente) {
        try {
          await enviarEmailRecordatorioTurno(turno);
        } catch (error) {
          console.error(`Error al enviar recordatorio del turno ${turno.id_turno}:`, error);
          continue; // no lo marcamos como enviado si falló, para reintentar en la próxima corrida
        }
      }
      await pool.execute('UPDATE turnos SET recordatorio_enviado = 1 WHERE id_turno = ?', [turno.id_turno]);
    }

    if (turnos.length > 0) {
      console.log(`Recordatorios de turno enviados: ${turnos.length}`);
    }
  } catch (error) {
    console.error('Error al revisar recordatorios de turnos:', error);
  }
}

const MS_ENTRE_REVISIONES_RECORDATORIO = 60 * 60 * 1000; // cada 1 hora
setInterval(revisarRecordatoriosTurnos, MS_ENTRE_REVISIONES_RECORDATORIO);
revisarRecordatoriosTurnos();

// ------------------ Crear Admin Automáticamente ------------------
(async () => {
  try {
    const conn = await pool.getConnection();

    const usuarioAdmin = 'admin';
    const correoAdmin = 'admin@padel.com';
    const passwordAdmin = '123';

    // ID de rol (1 = admin)
    const rolAdminId = 1;

    const [existingAdmin] = await conn.execute(
      'SELECT * FROM usuarios WHERE usuario = ? OR correo = ?',
      [usuarioAdmin, correoAdmin]
    );

    if (existingAdmin.length === 0) {
      const hashedPassword = await bcrypt.hash(passwordAdmin, 10);

      await conn.execute(
        'INSERT INTO usuarios (usuario, correo, password, metodo_registro, id_rol) VALUES (?, ?, ?, ?, ?)',
        [usuarioAdmin, correoAdmin, hashedPassword, 'manual', rolAdminId]
      );

      console.log('Administrador creado: usuario=admin, password=123');
    } else {
      console.log('Administrador ya existe.');
    }

    conn.release();
  } catch (error) {
    console.error('Error al crear admin:', error);
  }
})();

// ------------------ Registro Club/Usuario ------------------
// El club recién se crea (usuario + club + canchas) cuando Mercado Pago
// confirma que la suscripción del plan quedó autorizada; ver
// sincronizarRegistroClubPendiente y /registros-pendientes/estado/:id.
app.post('/usuarios/registro-club', async (req, res) => {
  const {
    nombreClub,
    nroTitular,
    provincia,
    localidad,
    direccion,
    correo,
    usuario,
    password,
    canchas,
    plan
  } = req.body;

  if (!nombreClub || !correo || !usuario || !password || !canchas) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const planElegido = PRECIOS_PLANES[plan] ? plan : 'basico';

  try {
    const [existingUser] = await pool.execute(
      'SELECT id_usuario FROM usuarios WHERE correo = ? OR usuario = ?',
      [correo, usuario]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ message: 'Correo o usuario ya existe' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [pendienteResult] = await pool.execute(
      `INSERT INTO registros_club_pendientes
        (nombre_club, nro_titular, provincia, localidad, direccion, correo, usuario, password_hash, canchas, plan, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
      [nombreClub, nroTitular, provincia, localidad, direccion, correo, usuario, hashedPassword, parseInt(canchas), planElegido]
    );
    const idRegistro = pendienteResult.insertId;

    if (!mpClient) {
      return res.status(201).json({
        message: 'No se pudo generar el pago: los pagos no están configurados en el servidor',
        id_registro: idRegistro,
        init_point: null
      });
    }

    const preapproval = new PreApproval(mpClient);
    const resultado = await preapproval.create({
      body: {
        reason: `Plan ${planElegido} - SaleUnPadel (${nombreClub})`,
        external_reference: String(idRegistro),
        payer_email: correo,
        back_url: FRONTEND_URL_ES_PUBLICA
          ? `${process.env.FRONTEND_URL}/registro-club/confirmacion?registro=${idRegistro}`
          : BACK_URL_RELLENO,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: PRECIOS_PLANES[planElegido],
          currency_id: 'ARS'
        },
        status: 'pending'
      }
    });

    await pool.execute(
      'UPDATE registros_club_pendientes SET mp_preapproval_id = ? WHERE id_registro = ?',
      [resultado.id, idRegistro]
    );

    res.status(201).json({
      message: 'Registro iniciado, falta autorizar el pago del plan',
      id_registro: idRegistro,
      init_point: resultado.init_point
    });

  } catch (error) {
    console.error('Error en registro club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Estado de un registro de club pendiente de pago ------------------
// Público (todavía no existe usuario/token en este punto del flujo).
app.get('/registros-pendientes/estado/:id', async (req, res) => {
  try {
    const resultado = await sincronizarRegistroClubPendiente(req.params.id);
    res.json(resultado);
  } catch (error) {
    console.error('Error en /registros-pendientes/estado:', error);
    res.status(500).json({ message: 'Error al consultar el estado del registro' });
  }
});

// ------------------ Registro Usuario (Cliente) ------------------
app.post('/FormUsuarios', async (req, res) => {
  const { nombre, apellido, dni, usuario, correo, telefono, password } = req.body;

  if (!nombre || !apellido || !dni || !usuario || !correo || !telefono || !password) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const conn = await pool.getConnection();

    // Verificar duplicados (usuario, correo o dni)
    const [existingUsers] = await conn.execute(
      'SELECT usuario, correo, dni FROM usuarios WHERE usuario = ? OR correo = ? OR dni = ?',
      [usuario, correo, dni]
    );

    if (existingUsers.length > 0) {
      conn.release();

      const usuarioDuplicado = existingUsers.some(u => u.usuario === usuario);
      const correoDuplicado = existingUsers.some(u => u.correo === correo);
      const dniDuplicado = existingUsers.some(u => u.dni === dni);

      if (usuarioDuplicado) {
        return res.status(400).json({ message: 'El nombre de usuario ya está en uso', campo: 'usuario' });
      }
      if (correoDuplicado) {
        return res.status(400).json({ message: 'El correo ya está registrado', campo: 'correo' });
      }
      if (dniDuplicado) {
        return res.status(400).json({ message: 'El DNI ya está registrado', campo: 'dni' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [insertResult] = await conn.execute(
      `INSERT INTO usuarios (nombre, apellido, dni, usuario, correo, telefono, password, metodo_registro, id_rol)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, dni, usuario, correo, telefono, hashedPassword, 'manual', 3]
    );

    conn.release();

    const token = jwt.sign(
      { id: insertResult.insertId, usuario, rol: 3 },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      message: 'Usuario registrado correctamente',
      token,
      id: insertResult.insertId,
      usuario,
      nombre,
      apellido,
      dni,
      correo,
      telefono,
      foto: null,
      rol: 3
    });

  } catch (error) {
  console.error('Error en registro usuario:', error);

  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(400).json({ message: 'El usuario, correo o DNI ya está registrado' });
  }

  res.status(500).json({ message: 'Error en el servidor' });
}
});

// ------------------ Login ------------------
app.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña obligatorios' });
  }

  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      'SELECT * FROM usuarios WHERE usuario = ? OR correo = ?',
      [usuario, usuario]
    );

    conn.release();

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    const isPasswordValid = await bcrypt.compare(password, rows[0].password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
    }

    if (!rows[0].activo) {
      return res.status(403).json({ message: 'Tu cuenta fue dada de baja. Contactá al administrador.' });
    }

    const token = jwt.sign(
      {
        id: rows[0].id_usuario,
        usuario: rows[0].usuario,
        rol: rows[0].id_rol
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      id: rows[0].id_usuario,
      usuario: rows[0].usuario,
      nombre: rows[0].nombre || rows[0].usuario, // si no tiene nombre (ej: admin), usa el usuario
      apellido: rows[0].apellido || '',
      dni: rows[0].dni || '',
      correo: rows[0].correo || '',
      telefono: rows[0].telefono || '',
      foto: rows[0].foto || null,
      rol: rows[0].id_rol
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Login con Google ------------------
const GOOGLE_CLIENT_ID = "852264110344-fgjqpscj6v4s4eg6tvchaii2ctiapoh0.apps.googleusercontent.com";
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.post('/usuarios/login-google', async (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ message: 'Falta token de Google' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const correo = payload.email;
    const usuario = payload.name;
    const foto = payload.picture; // <-- nuevo
    // Google ya nos da el nombre y apellido separados; usarlos evita que la
    // persona tenga que completar el apellido a mano después de registrarse.
    const nombreGoogle = payload.given_name || payload.name;
    const apellidoGoogle = payload.family_name || '';

    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      'SELECT * FROM usuarios WHERE correo = ?',
      [correo]
    );

    let rol = 3;
    let nombreFinal = nombreGoogle;
    let fotoFinal = foto;
    let idUsuarioFinal;
    let apellidoFinal = apellidoGoogle;
    let dniFinal = '';
    let telefonoFinal = '';

    if (rows.length === 0) {
    const [insertResult] = await conn.execute(
        'INSERT INTO usuarios (usuario, nombre, apellido, correo, foto, password, metodo_registro, id_rol) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [usuario, nombreGoogle, apellidoGoogle, correo, foto, '', 'google', 3]
    );
    idUsuarioFinal = insertResult.insertId;
} else {
    rol = rows[0].id_rol;
    nombreFinal = rows[0].nombre || usuario;
    idUsuarioFinal = rows[0].id_usuario;
    apellidoFinal = rows[0].apellido || '';
    dniFinal = rows[0].dni || '';
    telefonoFinal = rows[0].telefono || '';

    // Si el usuario ya existía pero no tenía foto, se la guardamos ahora
    if (!rows[0].foto && foto) {
        await conn.execute(
            'UPDATE usuarios SET foto = ? WHERE correo = ?',
            [foto, correo]
        );
        fotoFinal = foto;
    } else {
        fotoFinal = rows[0].foto || foto;
    }
}

    conn.release();

    const token = jwt.sign(
      { id: idUsuarioFinal, correo, usuario, rol },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      token,
      id: idUsuarioFinal,
      usuario,
      nombre: nombreFinal,
      apellido: apellidoFinal,
      dni: dniFinal,
      correo,
      telefono: telefonoFinal,
      foto: fotoFinal,
      rol
    });

  } catch (error) {
    console.error('Error en login Google:', error);
    res.status(401).json({ message: 'Token inválido' });
  }
});
app.post('/usuarios/solicitar-reset', async (req, res) => {
  const { correo } = req.body;
 
  if (!correo) {
    return res.status(400).json({ message: 'El correo es obligatorio' });
  }
 
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      'SELECT id_usuario, usuario FROM usuarios WHERE correo = ?',
      [correo]
    );
 
    // Importante: responder siempre lo mismo exista o no el correo,
    // para no revelar qué correos están registrados.
    if (rows.length === 0) {
      conn.release();
      return res.json({ message: 'Si el correo existe, te enviamos un enlace de recuperación.' });
    }
 
    const usuarioEncontrado = rows[0];
 
    // Generar token seguro y aleatorio
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(Date.now() + 30 * 60 * 1000); // vence en 30 minutos
 
    // Invalidar cualquier token anterior sin usar de este usuario
    await conn.execute(
      'UPDATE password_resets SET usado = 1 WHERE id_usuario = ? AND usado = 0',
      [usuarioEncontrado.id_usuario]
    );
 
    await conn.execute(
      'INSERT INTO password_resets (id_usuario, token, expira) VALUES (?, ?, ?)',
      [usuarioEncontrado.id_usuario, token, expira]
    );
 
    conn.release();
 
    const enlace = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
 
    await transporter.sendMail({
      from: `"Padel App" <${process.env.EMAIL_USER}>`,
      to: correo,
      subject: 'Recuperar acceso a tu cuenta',
      html: `
        <p>Hola,</p>
        <p>Tu nombre de usuario es: <b>${usuarioEncontrado.usuario}</b></p>
        <p>Para restablecer tu contraseña hacé clic en el siguiente enlace (válido por 30 minutos):</p>
        <p><a href="${enlace}">${enlace}</a></p>
        <p>Si no solicitaste esto, podés ignorar este correo.</p>
      `
    });
 
    res.json({ message: 'Si el correo existe, te enviamos un enlace de recuperación.' });
 
  } catch (error) {
    console.error('Error en solicitar-reset:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
 
// ------------------ Validar token (opcional, antes de mostrar el formulario) ------------------
app.get('/usuarios/validar-token/:token', async (req, res) => {
  const { token } = req.params;
 
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      'SELECT * FROM password_resets WHERE token = ? AND usado = 0 AND expira > NOW()',
      [token]
    );
 
    conn.release();
    res.json({ valido: rows.length > 0 });
 
  } catch (error) {
    console.error('Error en validar-token:', error);
    res.status(500).json({ valido: false });
  }
});
 
 
// ------------------ Resetear contraseña (paso 2: nueva contraseña con el token) ------------------
app.post('/usuarios/reset-password', async (req, res) => {
  const { token, password } = req.body;
 
  if (!token || !password) {
    return res.status(400).json({ message: 'Faltan datos' });
  }
 
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }
 
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      'SELECT * FROM password_resets WHERE token = ? AND usado = 0 AND expira > NOW()',
      [token]
    );
 
    if (rows.length === 0) {
      conn.release();
      return res.status(400).json({ message: 'El enlace es inválido o ya expiró' });
    }
 
    const reset = rows[0];
    const hashedPassword = await bcrypt.hash(password, 10);
 
    await conn.execute(
      'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
      [hashedPassword, reset.id_usuario]
    );
 
    await conn.execute(
      'UPDATE password_resets SET usado = 1 WHERE id = ?',
      [reset.id]
    );
 
    conn.release();
    res.json({ message: 'Contraseña actualizada correctamente' });
 
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
// ------------------ Obtener Usuarios según rol ------------------
app.get('/usuarios', verificarToken, requireRol(1, 2), async (req, res) => {
  const rol = req.usuario.rol;
  const id_usuario = req.usuario.id;

  try {
    const conn = await pool.getConnection();

    let query = '';
    let params = [];

    // 👑 ADMIN → ve todos
    if (Number(rol) === 1) {
      query = `
        SELECT id_usuario, usuario, nombre, apellido, correo, telefono, foto, id_rol, fecha_registro, activo
        FROM usuarios
      `;
    }

    // 🏟️ CLUB → ve clientes que reservaron en su club
    else if (Number(rol) === 2) {
  query = `
    SELECT
        u.id_usuario,
        u.usuario,
        u.nombre,
        u.apellido,
        u.correo,
        u.telefono,
        u.foto,
        u.id_rol,
        u.fecha_registro,
        COUNT(t.id_turno) AS total_turnos,
        MAX(t.fecha) AS ultima_reserva,
        (
          SELECT et.nombre
          FROM turnos t2
          INNER JOIN canchas c2 ON t2.id_cancha = c2.id_cancha
          INNER JOIN club cl2 ON c2.id_club = cl2.id_club
          INNER JOIN estados_turno et ON t2.id_estado = et.id_estado
          WHERE t2.id_usuario = u.id_usuario AND cl2.id_dueno = ?
          ORDER BY t2.fecha DESC
          LIMIT 1
        ) AS ultimo_estado
    FROM usuarios u
    INNER JOIN turnos t ON u.id_usuario = t.id_usuario
    INNER JOIN canchas c ON t.id_cancha = c.id_cancha
    INNER JOIN club cl ON c.id_club = cl.id_club
    WHERE cl.id_dueno = ?
    GROUP BY u.id_usuario, u.usuario, u.nombre, u.apellido, u.correo, u.telefono, u.foto, u.id_rol, u.fecha_registro
    ORDER BY total_turnos DESC
  `;
  params = [id_usuario, id_usuario];
}

    else {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [rows] = await conn.execute(query, params);

    conn.release();
    res.json(rows);

  } catch (error) {
    console.error('Error en /usuarios:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// ------------------ Clientes del club, con búsqueda, filtro, orden y paginado real (solo club) ------------------
// Igual que /usuarios para rol club, pero con LIMIT/OFFSET reales en vez de
// traer todo y filtrar en el front, para que se comporte igual que el resto
// de las listas paginadas (clubes, usuarios de admin).
app.get('/club/clientes-buscar', verificarToken, requireRol(2), async (req, res) => {
  const id_dueno = req.usuario.id;

  try {
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 12));
    const offset = (pagina - 1) * limite;
    const busqueda = (req.query.busqueda || '').trim();
    const estado = req.query.estado || 'todos'; // 'activo' | 'baja' | 'todos'

    const condiciones = ['cl.id_dueno = ?'];
    const params = [id_dueno];

    if (estado === 'activo') {
      condiciones.push('u.activo = 1');
    } else if (estado === 'baja') {
      condiciones.push('u.activo = 0');
    }

    if (busqueda) {
      const like = `%${busqueda}%`;
      condiciones.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.usuario LIKE ? OR u.correo LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereSql = `WHERE ${condiciones.join(' AND ')}`;

    const [totalRows] = await pool.query(
      `SELECT COUNT(DISTINCT u.id_usuario) AS total
       FROM usuarios u
       INNER JOIN turnos t ON u.id_usuario = t.id_usuario
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       ${whereSql}`,
      params
    );
    const total = totalRows[0].total;

    // Whitelist de columnas ordenables, para no interpolar nada que venga
    // directo del query string en el ORDER BY.
    const COLUMNAS_ORDEN = {
      nombre: 'nombre ${dir}, apellido ASC',
      fecha_registro: 'fecha_registro ${dir}',
      total_turnos: 'total_turnos ${dir}',
      ultima_reserva: 'ultima_reserva ${dir}'
    };
    const campoOrden = COLUMNAS_ORDEN[req.query.campo] ? req.query.campo : 'total_turnos';
    const dir = req.query.direccion === 'asc' ? 'ASC' : 'DESC';
    const orderBySql = COLUMNAS_ORDEN[campoOrden].replace(/\$\{dir\}/g, dir);

    const [rows] = await pool.query(
      `SELECT
          u.id_usuario, u.usuario, u.nombre, u.apellido, u.correo, u.telefono, u.foto,
          u.id_rol, u.fecha_registro, u.activo,
          COUNT(t.id_turno) AS total_turnos,
          MAX(t.fecha) AS ultima_reserva,
          (
            SELECT et.nombre
            FROM turnos t2
            INNER JOIN canchas c2 ON t2.id_cancha = c2.id_cancha
            INNER JOIN club cl2 ON c2.id_club = cl2.id_club
            INNER JOIN estados_turno et ON t2.id_estado = et.id_estado
            WHERE t2.id_usuario = u.id_usuario AND cl2.id_dueno = ?
            ORDER BY t2.fecha DESC
            LIMIT 1
          ) AS ultimo_estado
       FROM usuarios u
       INNER JOIN turnos t ON u.id_usuario = t.id_usuario
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       ${whereSql}
       GROUP BY u.id_usuario, u.usuario, u.nombre, u.apellido, u.correo, u.telefono, u.foto, u.id_rol, u.fecha_registro, u.activo
       ORDER BY ${orderBySql}
       LIMIT ${limite} OFFSET ${offset}`,
      [id_dueno, ...params]
    );

    res.json({
      clientes: rows,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    });
  } catch (error) {
    console.error('Error en /club/clientes-buscar:', error);
    res.status(500).json({ message: 'Error al buscar los clientes' });
  }
});

// ------------------ Listado de usuarios con búsqueda, filtro y paginado real (solo admin) ------------------
app.get('/usuarios/buscar', verificarToken, requireRol(1), async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 10));
    const offset = (pagina - 1) * limite;
    const busqueda = (req.query.busqueda || '').trim();
    const rol = req.query.rol || 'todos'; // '1' | '2' | '3' | 'todos'
    const estado = req.query.estado || 'todos'; // 'activo' | 'baja' | 'todos'

    const condiciones = [];
    const params = [];

    if (['1', '2', '3'].includes(rol)) {
      condiciones.push('id_rol = ?');
      params.push(Number(rol));
    }

    if (estado === 'activo') {
      condiciones.push('activo = 1');
    } else if (estado === 'baja') {
      condiciones.push('activo = 0');
    }

    if (busqueda) {
      const like = `%${busqueda}%`;
      condiciones.push('(nombre LIKE ? OR apellido LIKE ? OR usuario LIKE ? OR correo LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    // Whitelist de columnas ordenables, para no interpolar nada que venga
    // directo del query string en el ORDER BY.
    const COLUMNAS_ORDEN = {
      apellido: 'apellido ${dir}, nombre ASC',
      nombre: 'nombre ${dir}, apellido ASC',
      fecha_registro: 'fecha_registro ${dir}'
    };
    const campoOrden = COLUMNAS_ORDEN[req.query.campo] ? req.query.campo : 'fecha_registro';
    const dir = req.query.direccion === 'asc' ? 'ASC' : 'DESC';
    const orderBySql = COLUMNAS_ORDEN[campoOrden].replace(/\$\{dir\}/g, dir);

    const [totalRows] = await pool.execute(`SELECT COUNT(*) AS total FROM usuarios ${whereSql}`, params);
    const total = totalRows[0].total;

    const [rows] = await pool.query(
      `SELECT id_usuario, usuario, nombre, apellido, correo, telefono, foto, id_rol, fecha_registro, activo
       FROM usuarios
       ${whereSql}
       ORDER BY ${orderBySql}
       LIMIT ${limite} OFFSET ${offset}`,
      params
    );

    res.json({
      usuarios: rows,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    });
  } catch (error) {
    console.error('Error en /usuarios/buscar:', error);
    res.status(500).json({ message: 'Error al buscar los usuarios' });
  }
});

// ------------------ Dar de baja / reactivar un usuario (solo admin) ------------------
// Baja lógica: nunca se borra la fila, solo se marca activo = 0. Así se
// conserva el historial de turnos/pagos ligado a ese usuario.
app.put('/usuarios/:id/estado', verificarToken, requireRol(1), async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (activo !== 0 && activo !== 1) {
    return res.status(400).json({ message: 'El estado debe ser 0 o 1' });
  }

  if (Number(id) === req.usuario.id) {
    return res.status(400).json({ message: 'No podés darte de baja a vos mismo' });
  }

  try {
    const [result] = await pool.execute('UPDATE usuarios SET activo = ? WHERE id_usuario = ?', [activo, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({ message: activo ? 'Usuario reactivado' : 'Usuario dado de baja' });

  } catch (error) {
    console.error('Error al cambiar estado del usuario:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.get('/clubes/populares', async (req, res) => {
  const limite = parseInt(req.query.limit) || 3;
 
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      `SELECT
        c.id_club, c.nombre, c.direccion, c.provincia, c.localidad, c.telefono, c.horarios_atencion, c.plan, c.id_dueno,
        u.usuario AS dueno, u.foto AS foto_dueno,
        (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.activo = 1) AS cantidad_canchas,
        (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL AND ca.activo = 1) AS precio_desde,
        (SELECT ROUND(AVG(r.puntuacion), 1) FROM resenas r WHERE r.id_club = c.id_club) AS promedio_resenas,
        (SELECT COUNT(*) FROM resenas r WHERE r.id_club = c.id_club) AS cantidad_resenas,
        (
          SELECT COUNT(*)
          FROM turnos t
          INNER JOIN canchas ca2 ON t.id_cancha = ca2.id_cancha
          WHERE ca2.id_club = c.id_club
        ) AS total_turnos
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
      WHERE c.activo = 1
      ORDER BY total_turnos DESC, c.id_club ASC
      LIMIT ?`,
      [limite]
    );
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /clubes/populares:', error);
    res.status(500).json({ message: 'Error al obtener los clubes populares' });
  }
});
// ------------------ Obtener todos los Clubes ------------------
app.get('/clubes', async (req, res) => {
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(`
      SELECT
        c.id_club, c.nombre, c.direccion, c.provincia, c.localidad, c.telefono, c.horarios_atencion, c.plan, c.id_dueno,
        u.usuario AS dueno, u.foto AS foto_dueno,
        (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.activo = 1) AS cantidad_canchas,
        (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL AND ca.activo = 1) AS precio_desde,
        (SELECT ROUND(AVG(r.puntuacion), 1) FROM resenas r WHERE r.id_club = c.id_club) AS promedio_resenas,
        (SELECT COUNT(*) FROM resenas r WHERE r.id_club = c.id_club) AS cantidad_resenas
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
      WHERE c.activo = 1
    `);
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /clubes:', error);
    res.status(500).json({ message: 'Error al obtener clubes' });
  }

});

// ------------------ Obtener un club puntual (vista pública) ------------------
app.get('/clubes/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT
        c.id_club, c.nombre, c.direccion, c.provincia, c.localidad, c.telefono, c.horarios_atencion, c.plan, c.id_dueno,
        u.usuario AS dueno, u.foto AS foto_dueno,
        (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.activo = 1) AS cantidad_canchas,
        (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL AND ca.activo = 1) AS precio_desde,
        (SELECT ROUND(AVG(r.puntuacion), 1) FROM resenas r WHERE r.id_club = c.id_club) AS promedio_resenas,
        (SELECT COUNT(*) FROM resenas r WHERE r.id_club = c.id_club) AS cantidad_resenas
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
      WHERE c.id_club = ? AND c.activo = 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    res.json(rows[0]);

  } catch (error) {
    console.error('Error en /clubes/:id:', error);
    res.status(500).json({ message: 'Error al obtener el club' });
  }
});

// ------------------ Reseñas de un club (vista pública) ------------------
app.get('/clubes/:id/resenas', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      `SELECT r.id_resena, r.id_usuario, r.puntuacion, r.comentario, r.fecha,
              u.nombre, u.apellido, u.usuario, u.foto
       FROM resenas r
       INNER JOIN usuarios u ON r.id_usuario = u.id_usuario
       WHERE r.id_club = ?
       ORDER BY r.fecha DESC
       LIMIT 50`,
      [id]
    );

    res.json(rows);

  } catch (error) {
    console.error('Error en /clubes/:id/resenas:', error);
    res.status(500).json({ message: 'Error al obtener las reseñas' });
  }
});

// ------------------ Dejar o editar mi reseña de un club (solo clientes) ------------------
// Solo puede reseñar quien jugó alguna vez en ese club (turno completado).
// Una reseña por cliente por club: si ya existe, se actualiza.
app.post('/clubes/:id/resenas', verificarToken, requireRol(3), async (req, res) => {
  const { id } = req.params;
  const { puntuacion, comentario } = req.body;

  const puntuacionNum = Number(puntuacion);
  if (!Number.isInteger(puntuacionNum) || puntuacionNum < 1 || puntuacionNum > 5) {
    return res.status(400).json({ message: 'La puntuación debe ser un número entero entre 1 y 5' });
  }

  try {
    const [jugoAca] = await pool.execute(
      `SELECT 1
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE c.id_club = ? AND t.id_usuario = ? AND et.nombre = 'completado'
       LIMIT 1`,
      [id, req.usuario.id]
    );

    if (jugoAca.length === 0) {
      return res.status(403).json({ message: 'Solo podés dejar una reseña si jugaste en este club' });
    }

    const [existente] = await pool.execute(
      'SELECT id_resena FROM resenas WHERE id_club = ? AND id_usuario = ?',
      [id, req.usuario.id]
    );

    if (existente.length > 0) {
      await pool.execute(
        'UPDATE resenas SET puntuacion = ?, comentario = ?, fecha = NOW() WHERE id_resena = ?',
        [puntuacionNum, comentario || null, existente[0].id_resena]
      );
    } else {
      await pool.execute(
        'INSERT INTO resenas (id_club, id_usuario, puntuacion, comentario) VALUES (?, ?, ?, ?)',
        [id, req.usuario.id, puntuacionNum, comentario || null]
      );
    }

    res.json({ message: 'Reseña guardada correctamente' });

  } catch (error) {
    console.error('Error en POST /clubes/:id/resenas:', error);
    res.status(500).json({ message: 'Error al guardar la reseña' });
  }
});

// ------------------ Eliminar una reseña (dueño de la reseña o admin) ------------------
app.delete('/resenas/:id', verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [resenaRows] = await pool.execute('SELECT id_usuario FROM resenas WHERE id_resena = ?', [id]);
    if (resenaRows.length === 0) {
      return res.status(404).json({ message: 'Reseña no encontrada' });
    }

    const esAutor = resenaRows[0].id_usuario === req.usuario.id;
    const esAdmin = Number(req.usuario.rol) === 1;
    if (!esAutor && !esAdmin) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await pool.execute('DELETE FROM resenas WHERE id_resena = ?', [id]);
    res.json({ message: 'Reseña eliminada correctamente' });

  } catch (error) {
    console.error('Error en DELETE /resenas/:id:', error);
    res.status(500).json({ message: 'Error al eliminar la reseña' });
  }
});

// ------------------ Clubes con datos de suscripción (solo admin) ------------------
// en_mora: la suscripción figura "activa" pero ya pasó la fecha del próximo
// pago sin que haya uno nuevo registrado (ver /pagos/webhook, evento
// subscription_authorized_payment, que es lo único que adelanta
// proxima_fecha_pago). Es un estado calculado, no se guarda en la tabla.
const CAMPOS_CLUB_ADMIN = `
  c.id_club, c.nombre, c.direccion, c.provincia, c.localidad, c.telefono, c.horarios_atencion,
  c.plan, c.id_dueno, c.estado_suscripcion, c.proxima_fecha_pago, c.fecha_alta, c.activo,
  c.motivo_baja, c.dado_de_baja_en,
  (c.activo = 1 AND c.estado_suscripcion <> 'cancelada' AND c.proxima_fecha_pago IS NOT NULL AND c.proxima_fecha_pago < CURDATE()) AS en_mora,
  u.usuario AS dueno, u.nombre AS nombre_dueno, u.apellido AS apellido_dueno,
  u.correo AS correo_dueno, u.telefono AS telefono_dueno, u.foto AS foto_dueno,
  (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.activo = 1) AS cantidad_canchas,
  (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL AND ca.activo = 1) AS precio_desde
`;

app.get('/admin/clubes', verificarToken, requireRol(1), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT ${CAMPOS_CLUB_ADMIN}
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
      ORDER BY c.fecha_alta DESC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error en /admin/clubes:', error);
    res.status(500).json({ message: 'Error al obtener los clubes' });
  }
});

// ------------------ Ingreso real acumulado por planes de clubes (solo admin) ------------------
// Suma cada cobro mensual efectivamente recibido (ver pagos_planes y el
// webhook subscription_authorized_payment), no una proyección.
// La suscripción se renueva cada mes, así que sumar TODOS los cobros
// históricos infla el número (un club de un año sumaría 12 cuotas). Lo que
// importa acá es cuánto entra por mes: los cobros reales de este mes.
app.get('/admin/ingresos-planes', verificarToken, requireRol(1), async (req, res) => {
  try {
    const [[{ total }]] = await pool.execute(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM pagos_planes
       WHERE YEAR(fecha) = YEAR(CURDATE()) AND MONTH(fecha) = MONTH(CURDATE())`
    );
    res.json({ total: Number(total) });
  } catch (error) {
    console.error('Error en /admin/ingresos-planes:', error);
    res.status(500).json({ message: 'Error al obtener los ingresos' });
  }
});

// ------------------ Balance histórico de ingresos por planes, mes a mes (solo admin) ------------------
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatearPeriodoLargo(periodo) {
  const [anio, mes] = periodo.split('-');
  return `${MESES_ES[Number(mes) - 1]} ${anio}`;
}

async function obtenerBalanceMensualAdmin() {
  const [filas] = await pool.execute(
    `SELECT DATE_FORMAT(fecha, '%Y-%m') AS periodo,
            SUM(monto) AS total,
            COUNT(*) AS cantidad_pagos,
            COUNT(DISTINCT id_club) AS cantidad_clubes
     FROM pagos_planes
     GROUP BY DATE_FORMAT(fecha, '%Y-%m')
     ORDER BY periodo DESC`
  );

  const meses = filas.map((f) => ({
    periodo: f.periodo,
    total: Number(f.total),
    cantidad_pagos: f.cantidad_pagos,
    cantidad_clubes: f.cantidad_clubes
  }));

  const totalHistorico = meses.reduce((acc, m) => acc + m.total, 0);
  const promedioMensual = meses.length > 0 ? totalHistorico / meses.length : 0;

  return { meses, totalHistorico, promedioMensual };
}

app.get('/admin/balance-mensual', verificarToken, requireRol(1), async (req, res) => {
  try {
    const { meses, totalHistorico, promedioMensual } = await obtenerBalanceMensualAdmin();
    res.json({ meses, total_historico: totalHistorico, promedio_mensual: promedioMensual });
  } catch (error) {
    console.error('Error en /admin/balance-mensual:', error);
    res.status(500).json({ message: 'Error al obtener el balance' });
  }
});

// ------------------ Balance histórico de ingresos por planes, en Excel real (con formato y data bars) ------------------
app.get('/admin/balance-mensual/excel', verificarToken, requireRol(1), async (req, res) => {
  try {
    const { meses, totalHistorico, promedioMensual } = await obtenerBalanceMensualAdmin();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SUP - Sale un Padel';
    workbook.created = new Date();

    const hojaResumen = workbook.addWorksheet('Resumen');
    hojaResumen.columns = [{ width: 30 }, { width: 22 }];
    hojaResumen.mergeCells('A1:B1');
    hojaResumen.getCell('A1').value = 'Balance de Suscripciones';
    hojaResumen.getCell('A1').font = { bold: true, size: 16, color: { argb: COLOR_ENCABEZADO } };
    hojaResumen.addRow([]);

    const filaEncabezadoResumen = hojaResumen.addRow(['Indicador', 'Valor']);
    estiloEncabezado(filaEncabezadoResumen);

    const filaTotal = hojaResumen.addRow(['Ingreso histórico acumulado', totalHistorico]);
    filaTotal.getCell(2).numFmt = '$#,##0';
    const filaPromedio = hojaResumen.addRow(['Promedio mensual', promedioMensual]);
    filaPromedio.getCell(2).numFmt = '$#,##0';
    hojaResumen.addRow(['Meses con cobros registrados', meses.length]);

    const hojaMeses = workbook.addWorksheet('Balance mensual');
    hojaMeses.columns = [
      { header: 'Mes', key: 'mes', width: 20 },
      { header: 'Clubes que pagaron', key: 'clubes', width: 20 },
      { header: 'Cantidad de cobros', key: 'cobros', width: 20 },
      { header: 'Total ingresado', key: 'total', width: 20 }
    ];
    estiloEncabezado(hojaMeses.getRow(1));
    hojaMeses.autoFilter = { from: 'A1', to: 'D1' };
    hojaMeses.views = [{ state: 'frozen', ySplit: 1 }];

    for (const m of meses) {
      const fila = hojaMeses.addRow({
        mes: formatearPeriodoLargo(m.periodo),
        clubes: m.cantidad_clubes,
        cobros: m.cantidad_pagos,
        total: m.total
      });
      fila.getCell('total').numFmt = '$#,##0';
    }

    if (meses.length > 0) {
      hojaMeses.addConditionalFormatting({
        ref: `D2:D${meses.length + 1}`,
        rules: [
          {
            type: 'dataBar',
            minLength: 0,
            maxLength: 100,
            gradient: true,
            border: true,
            negativeBarColorSameAsPositive: false,
            negativeBarBorderColorSameAsPositive: true,
            axisPosition: 'automatic',
            direction: 'leftToRight',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: 'FF1B7A3D' }
          }
        ]
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="balance-suscripciones.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en /admin/balance-mensual/excel:', error);
    res.status(500).json({ message: 'Error al generar el Excel' });
  }
});

// ------------------ Listado de clubes con búsqueda, filtro y paginado real (solo admin) ------------------
// A diferencia de /admin/clubes (que trae todo, usado para las estadísticas
// del resumen), acá la base de datos hace el LIMIT/OFFSET y el filtrado, para
// no traer de más cuando haya muchos clubes.
// IMPORTANTE: esta ruta va ANTES de /admin/clubes/:id a propósito (mismo
// motivo que /club/dias-atencion antes de /club/:id: si no, "buscar" matchea
// como si fuera un id).
app.get('/admin/clubes/buscar', verificarToken, requireRol(1), async (req, res) => {
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 10));
    const offset = (pagina - 1) * limite;
    const busqueda = (req.query.busqueda || '').trim();
    const estado = req.query.estado || 'todos'; // 'activo' | 'baja' | 'todos'

    const condiciones = [];
    const params = [];

    if (estado === 'activo') {
      condiciones.push('c.activo = 1');
    } else if (estado === 'baja') {
      condiciones.push('c.activo = 0');
    }

    if (busqueda) {
      const like = `%${busqueda}%`;
      condiciones.push('(c.nombre LIKE ? OR c.localidad LIKE ? OR u.usuario LIKE ? OR u.nombre LIKE ? OR u.apellido LIKE ?)');
      params.push(like, like, like, like, like);
    }

    const whereSql = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM club c
       LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
       ${whereSql}`,
      params
    );
    const total = totalRows[0].total;

    const [rows] = await pool.query(
      `SELECT ${CAMPOS_CLUB_ADMIN}
       FROM club c
       LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
       ${whereSql}
       ORDER BY c.fecha_alta DESC
       LIMIT ${limite} OFFSET ${offset}`,
      params
    );

    res.json({
      clubes: rows,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    });
  } catch (error) {
    console.error('Error en /admin/clubes/buscar:', error);
    res.status(500).json({ message: 'Error al buscar los clubes' });
  }
});

app.get('/admin/clubes/:id', verificarToken, requireRol(1), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT ${CAMPOS_CLUB_ADMIN}
       FROM club c
       LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
       WHERE c.id_club = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Error en /admin/clubes/:id:', error);
    res.status(500).json({ message: 'Error al obtener el club' });
  }
});

// ------------------ Dar de baja un club (solo admin) ------------------
// Baja lógica: el club nunca se borra de la tabla, solo se marca activo = 0.
// Así los turnos, pagos y estadísticas históricas ligadas a ese club siguen
// intactos; el club solo deja de verse en las búsquedas públicas.
app.delete('/clubes/:id', verificarToken, requireRol(1), async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  if (!motivo || !motivo.trim()) {
    return res.status(400).json({ message: 'El motivo de la baja es obligatorio' });
  }

  try {
    const [clubRows] = await pool.execute(
      `SELECT c.nombre, u.nombre AS nombre_dueno, u.correo AS correo_dueno
       FROM club c LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
       WHERE c.id_club = ?`,
      [id]
    );

    if (clubRows.length === 0) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    await pool.execute(
      'UPDATE club SET activo = 0, motivo_baja = ?, dado_de_baja_en = NOW() WHERE id_club = ?',
      [motivo.trim(), id]
    );

    const { nombre, nombre_dueno, correo_dueno } = clubRows[0];

    // Turnos futuros que seguían reservados: el club deja de operar, así que
    // no tiene sentido dejarlos como si fueran a jugarse. Se cancelan y se le
    // avisa a cada cliente, igual que una cancelación manual del club.
    const [turnosAfectados] = await pool.query(
      `SELECT
          t.id_turno, t.fecha,
          h.hora_inicio, h.hora_fin,
          c.nombre AS nombre_cancha,
          u.correo AS correo_cliente, u.nombre AS nombre_cliente
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE c.id_club = ? AND et.nombre = 'reservado' AND t.fecha >= CURDATE()`,
      [id]
    );

    if (turnosAfectados.length > 0) {
      const idsTurnos = turnosAfectados.map((t) => t.id_turno);
      const placeholders = idsTurnos.map(() => '?').join(',');

      await pool.query(
        `UPDATE turnos SET id_estado = (SELECT id_estado FROM estados_turno WHERE nombre = 'cancelado')
         WHERE id_turno IN (${placeholders})`,
        idsTurnos
      );

      // Las señas ya pagadas no se tocan (no hay reintegro automático); solo
      // se limpian los pagos pendientes, igual que en la cancelación manual.
      await pool.query(
        `DELETE FROM pagos WHERE id_turno IN (${placeholders}) AND estado = 'pendiente'`,
        idsTurnos
      );

      const motivoParaClientes = `El club ${nombre} fue dado de baja en la plataforma.`;
      for (const t of turnosAfectados) {
        if (t.correo_cliente) {
          enviarEmailCancelacionTurno({ ...t, nombre_club: nombre }, motivoParaClientes).catch((error) => {
            console.error('Error al enviar el correo de cancelación por baja de club:', error);
          });
        }
      }
    }

    if (correo_dueno) {
      enviarEmailBajaClub(nombre, nombre_dueno, correo_dueno, motivo.trim()).catch((error) => {
        console.error('Error al enviar el mail de baja del club:', error);
      });
    }

    res.json({
      message: 'Club dado de baja correctamente',
      turnos_cancelados: turnosAfectados.length
    });

  } catch (error) {
    console.error('Error al dar de baja el club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Reactivar un club dado de baja (solo admin) ------------------
app.put('/clubes/:id/estado', verificarToken, requireRol(1), async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  if (activo !== 0 && activo !== 1) {
    return res.status(400).json({ message: 'El estado debe ser 0 o 1' });
  }

  try {
    const [result] = await pool.execute('UPDATE club SET activo = ? WHERE id_club = ?', [activo, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    res.json({ message: activo ? 'Club reactivado' : 'Club dado de baja' });

  } catch (error) {
    console.error('Error al cambiar estado del club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.get('/club/mi-club', verificarToken, requireRol(2), async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      'SELECT * FROM club WHERE id_dueno = ?',
      [req.usuario.id]
    );
 
    conn.release();
 
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un club para este usuario' });
    }
 
    res.json(rows[0]);
 
  } catch (error) {
    console.error('Error en /club/mi-club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Estado de pago del club (para bloquear el panel si está en mora) ------------------
app.get('/club/estado-pago', verificarToken, requireRol(2), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
          activo, estado_suscripcion, proxima_fecha_pago, motivo_baja,
          (activo = 1 AND estado_suscripcion <> 'cancelada' AND proxima_fecha_pago IS NOT NULL AND proxima_fecha_pago < CURDATE()) AS en_mora
       FROM club WHERE id_dueno = ?`,
      [req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un club para este usuario' });
    }

    const club = rows[0];
    const dadoDeBaja = !club.activo;
    const enMora = !!club.en_mora;

    // Dos motivos distintos pueden bloquear el panel: el admin dio de baja el
    // club (nada que el dueño pueda resolver solo), o se venció el pago de
    // la suscripción (se resuelve desde Planes). El dueño necesita saber cuál
    // es para no mandarlo a pagar algo que no le va a reactivar la cuenta.
    const motivo = dadoDeBaja ? 'baja' : (enMora ? 'mora' : null);

    res.json({
      bloqueado: dadoDeBaja || enMora,
      motivo,
      motivo_baja: dadoDeBaja ? club.motivo_baja : null,
      en_mora: enMora,
      estado_suscripcion: club.estado_suscripcion,
      proxima_fecha_pago: club.proxima_fecha_pago
    });

  } catch (error) {
    console.error('Error en /club/estado-pago:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Días y horario de atención del club ------------------
// (a partir de esto se calculan, para el cliente, los rangos de horario
// disponibles para reservar: cada club dice a qué hora abre y cierra cada
// día, y el cliente elige hora de inicio + duración dentro de ese rango)
//
// IMPORTANTE: estas rutas literales van ANTES de PUT /club/:id a propósito.
// Express matchea rutas en el orden en que se registran, y "/club/:id" con
// id="dias-atencion" matchea igual de bien "/club/dias-atencion" — si esta
// ruta quedara después, PUT /club/:id se la comería primero.

app.get('/club/dias-atencion', async (req, res) => {
  const { id_club } = req.query;
  if (!id_club) return res.status(400).json({ message: 'Falta id_club' });

  try {
    const [rows] = await pool.execute(
      'SELECT id_dia_atencion, numero_dia, hora_apertura, hora_cierre FROM club_dias_atencion WHERE id_club = ? ORDER BY numero_dia ASC',
      [id_club]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en /club/dias-atencion:', error);
    res.status(500).json({ message: 'Error al obtener los días de atención' });
  }
});

// Crea o actualiza el horario de un día puntual (0=Lunes ... 6=Domingo)
app.put('/club/dias-atencion', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_club, numero_dia, hora_apertura, hora_cierre } = req.body;

  if (id_club === undefined || numero_dia === undefined || !hora_apertura || !hora_cierre) {
    return res.status(400).json({ message: 'Faltan datos' });
  }
  if (numero_dia < 0 || numero_dia > 6) {
    return res.status(400).json({ message: 'Día inválido' });
  }
  if (hora_apertura >= hora_cierre) {
    return res.status(400).json({ message: 'La hora de apertura debe ser anterior a la de cierre' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await pool.execute(
      `INSERT INTO club_dias_atencion (id_club, numero_dia, hora_apertura, hora_cierre)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE hora_apertura = VALUES(hora_apertura), hora_cierre = VALUES(hora_cierre)`,
      [id_club, numero_dia, hora_apertura, hora_cierre]
    );

    res.json({ message: 'Día actualizado correctamente' });
  } catch (error) {
    console.error('Error al guardar día de atención:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// Marca un día como cerrado (deja de ofrecerse para reservar)
app.delete('/club/dias-atencion/:idClub/:numeroDia', verificarToken, requireRol(1, 2), async (req, res) => {
  const { idClub, numeroDia } = req.params;

  try {
    if (!(await verificarDuenoDeClub(req, idClub))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await pool.execute(
      'DELETE FROM club_dias_atencion WHERE id_club = ? AND numero_dia = ?',
      [idClub, numeroDia]
    );
    res.json({ message: 'Día marcado como cerrado' });
  } catch (error) {
    console.error('Error al cerrar día de atención:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.put('/club/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, localidad, provincia, telefono, horarios_atencion, hora_inicio_nocturno } = req.body;

  if (!nombre || !direccion || !localidad || !telefono) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      'UPDATE club SET nombre = ?, direccion = ?, localidad = ?, provincia = ?, telefono = ?, horarios_atencion = ?, hora_inicio_nocturno = ? WHERE id_club = ?',
      [nombre, direccion, localidad, provincia || null, telefono, horarios_atencion || null, hora_inicio_nocturno || null, id]
    );

    conn.release();
    res.json({ message: 'Datos del club actualizados correctamente' });

  } catch (error) {
    console.error('Error al actualizar club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.put('/club/:id/plan', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  const { plan } = req.body;

  if (!plan) {
    return res.status(400).json({ message: 'Falta el plan' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();
 
    await conn.execute(
      'UPDATE club SET plan = ? WHERE id_club = ?',
      [plan, id]
    );
 
    conn.release();
    res.json({ message: 'Plan actualizado correctamente' });
 
  } catch (error) {
    console.error('Error al actualizar plan:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Cambiar de plan un club ya activo (con pago real) ------------------
// A diferencia de PUT /club/:id/plan (que cambia el plan directo, sin pago,
// pensado para uso administrativo), este endpoint genera una suscripción
// nueva en Mercado Pago; el plan recién se actualiza cuando el dueño del
// club autoriza el pago (ver sincronizarCambioPlanClub).
app.post('/club/:id/cambiar-plan', verificarToken, requireRol(2), async (req, res) => {
  const { id } = req.params;
  const { plan } = req.body;

  if (!plan || !PRECIOS_PLANES[plan]) {
    return res.status(400).json({ message: 'Plan inválido' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [clubRows] = await pool.execute('SELECT nombre, plan FROM club WHERE id_club = ?', [id]);
    if (clubRows.length === 0) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }
    const club = clubRows[0];

    if (club.plan === plan) {
      return res.status(400).json({ message: 'Ese ya es tu plan actual' });
    }

    if (!mpClient) {
      return res.status(503).json({ message: 'Los pagos no están configurados en el servidor' });
    }

    const [usuarioRows] = await pool.execute('SELECT correo FROM usuarios WHERE id_usuario = ?', [req.usuario.id]);
    const correo = usuarioRows[0]?.correo;

    const preapproval = new PreApproval(mpClient);
    const resultado = await preapproval.create({
      body: {
        reason: `Plan ${plan} - SaleUnPadel (${club.nombre})`,
        external_reference: `cambio-plan-${id}`,
        payer_email: correo,
        back_url: FRONTEND_URL_ES_PUBLICA
          ? `${process.env.FRONTEND_URL}/planes?cambioPlan=${id}`
          : BACK_URL_RELLENO,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: PRECIOS_PLANES[plan],
          currency_id: 'ARS'
        },
        status: 'pending'
      }
    });

    await pool.execute(
      'UPDATE club SET plan_pendiente = ?, mp_preapproval_pendiente_id = ? WHERE id_club = ?',
      [plan, resultado.id, id]
    );

    res.json({
      message: 'Cambio de plan iniciado, falta autorizar el pago',
      init_point: resultado.init_point
    });

  } catch (error) {
    console.error('Error al iniciar cambio de plan:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Estado de un cambio de plan pendiente ------------------
// La consulta la pantalla de Planes cuando el dueño del club vuelve de
// autorizar (o no) el pago en Mercado Pago.
app.get('/club/:id/estado-cambio-plan', verificarToken, requireRol(2), async (req, res) => {
  const { id } = req.params;

  try {
    if (!(await verificarDuenoDeClub(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const resultado = await sincronizarCambioPlanClub(id);
    res.json(resultado);

  } catch (error) {
    console.error('Error en /club/:id/estado-cambio-plan:', error);
    res.status(500).json({ message: 'Error al consultar el estado del cambio de plan' });
  }
});

app.post('/canchas/upload-foto', verificarToken, requireRol(1, 2), uploadCancha.single('foto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No se recibió ninguna imagen' });
  }
 
  // Devolvemos la URL completa, lista para guardar en canchas.foto
  const url = `http://localhost:3000/uploads/canchas/${req.file.filename}`;
  res.json({ foto: url });
});
 const storageClub = multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'uploads/club');
        },
        filename: (req, file, cb) => {
          const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          cb(null, nombreUnico);
        }
      });
      const uploadClubFoto = multer({ storage: storageClub });

      // ------------------ Foto de perfil (club o cliente) ------------------
      const storagePerfil = multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, 'uploads/perfiles');
        },
        filename: (req, file, cb) => {
          const nombreUnico = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          cb(null, nombreUnico);
        }
      });
      const uploadFotoPerfil = multer({ storage: storagePerfil });

      app.post('/usuarios/:id/foto', verificarToken, uploadFotoPerfil.single('foto'), async (req, res) => {
        const { id } = req.params;

        if (Number(req.usuario.rol) !== 1 && req.usuario.id !== Number(id)) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        if (!req.file) {
          return res.status(400).json({ message: 'No se recibió ninguna imagen' });
        }

        try {
          const url = `http://localhost:3000/uploads/perfiles/${req.file.filename}`;
          await pool.execute('UPDATE usuarios SET foto = ? WHERE id_usuario = ?', [url, id]);
          res.json({ foto: url });
        } catch (error) {
          console.error('Error al guardar la foto de perfil:', error);
          res.status(500).json({ message: 'Error en el servidor' });
        }
      });

      app.get('/club/fotos', async (req, res) => {
  const { id_club } = req.query;
  if (!id_club) return res.status(400).json({ message: 'Falta id_club' });
 
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id_foto, url FROM club_fotos WHERE id_club = ? ORDER BY id_foto ASC',
      [id_club]
    );
    conn.release();
    res.json(rows);
  } catch (error) {
    console.error('Error en /club/fotos:', error);
    res.status(500).json({ message: 'Error al obtener las fotos' });
  }
});
 
app.post('/club/fotos/upload', verificarToken, requireRol(1, 2), uploadClubFoto.single('foto'), async (req, res) => {
  const { id_club } = req.body;

  if (!req.file) {
    return res.status(400).json({ message: 'No se recibió ninguna imagen' });
  }
  if (!id_club) {
    return res.status(400).json({ message: 'Falta id_club' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const url = `http://localhost:3000/uploads/club/${req.file.filename}`;
 
    const conn = await pool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO club_fotos (id_club, url) VALUES (?, ?)',
      [id_club, url]
    );
    conn.release();
 
    res.status(201).json({ id_foto: result.insertId, url });
 
  } catch (error) {
    console.error('Error al guardar foto del club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
app.delete('/club/fotos/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await pool.getConnection();

    const [fotoRows] = await conn.execute('SELECT id_club FROM club_fotos WHERE id_foto = ?', [id]);
    if (fotoRows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Foto no encontrada' });
    }
    if (!(await verificarDuenoDeClub(req, fotoRows[0].id_club))) {
      conn.release();
      return res.status(403).json({ message: 'No autorizado' });
    }

    await conn.execute('DELETE FROM club_fotos WHERE id_foto = ?', [id]);
    conn.release();
    res.json({ message: 'Foto eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar foto del club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
 
// ------------------ Servicios adicionales del club ------------------
 
app.get('/club/servicios', async (req, res) => {
  const { id_club } = req.query;
  if (!id_club) return res.status(400).json({ message: 'Falta id_club' });
 
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.execute(
      'SELECT id_servicio, nombre FROM club_servicios WHERE id_club = ? ORDER BY id_servicio ASC',
      [id_club]
    );
    conn.release();
    res.json(rows);
  } catch (error) {
    console.error('Error en /club/servicios:', error);
    res.status(500).json({ message: 'Error al obtener los servicios' });
  }
});
 
app.post('/club/servicios', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_club, nombre } = req.body;

  if (!id_club || !nombre) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();
    const [result] = await conn.execute(
      'INSERT INTO club_servicios (id_club, nombre) VALUES (?, ?)',
      [id_club, nombre]
    );
    conn.release();
 
    res.status(201).json({ id_servicio: result.insertId });
 
  } catch (error) {
    console.error('Error al agregar servicio:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
app.delete('/club/servicios/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await pool.getConnection();

    const [servicioRows] = await conn.execute('SELECT id_club FROM club_servicios WHERE id_servicio = ?', [id]);
    if (servicioRows.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Servicio no encontrado' });
    }
    if (!(await verificarDuenoDeClub(req, servicioRows[0].id_club))) {
      conn.release();
      return res.status(403).json({ message: 'No autorizado' });
    }

    await conn.execute('DELETE FROM club_servicios WHERE id_servicio = ?', [id]);
    conn.release();
    res.json({ message: 'Servicio eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar servicio:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

 // ------------------ Agregar una cancha nueva al club ------------------
app.post('/club/canchas', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_club, nombre, tipo, foto, precio, precio_nocturno } = req.body;

  if (!id_club || !nombre) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    const [result] = await conn.execute(
      'INSERT INTO canchas (nombre, estado, id_club, tipo, foto, precio, precio_nocturno) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [nombre, 'disponible', id_club, tipo || null, foto || null, precio || null, precio_nocturno || null]
    );
 
    conn.release();
 
    res.status(201).json({
      message: 'Cancha agregada correctamente',
      id_cancha: result.insertId
    });
 
  } catch (error) {
    console.error('Error al agregar cancha:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
// ------------------ Canchas de un club (con turnos de esta semana) ------------------
app.get('/club/canchas', async (req, res) => {
  const { id_club } = req.query;
 
  if (!id_club) {
    return res.status(400).json({ message: 'Falta id_club' });
  }
 
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      `SELECT
          c.id_cancha,
          c.nombre,
          c.estado,
          c.tipo,
          c.foto,
          c.precio,
          c.precio_nocturno,
          (
            SELECT COUNT(*)
            FROM turnos t
            INNER JOIN estados_turno et ON t.id_estado = et.id_estado
            WHERE t.id_cancha = c.id_cancha
              AND et.nombre <> 'cancelado'
              AND YEARWEEK(t.fecha, 1) = YEARWEEK(CURDATE(), 1)
          ) AS turnos_semana
       FROM canchas c
       WHERE c.id_club = ? AND c.activo = 1
       ORDER BY c.nombre ASC`,
      [id_club]
    );
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /club/canchas:', error);
    res.status(500).json({ message: 'Error al obtener las canchas' });
  }
});

// ------------------ Mis canchas (dueño del club, incluye las dadas de baja) ------------------
// A diferencia de /club/canchas (pública, para reservar, solo activas), esta
// es la que usa el dueño para gestionar su club: necesita seguir viendo las
// canchas que dio de baja (para reactivarlas o consultar su historial de
// turnos), no que desaparezcan sin dejar rastro.
app.get('/club/mis-canchas', verificarToken, requireRol(2), async (req, res) => {
  try {
    const [clubRows] = await pool.execute('SELECT id_club FROM club WHERE id_dueno = ?', [req.usuario.id]);

    if (clubRows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un club para este usuario' });
    }

    const idClub = clubRows[0].id_club;

    const [rows] = await pool.execute(
      `SELECT
          c.id_cancha,
          c.nombre,
          c.estado,
          c.tipo,
          c.foto,
          c.precio,
          c.precio_nocturno,
          c.activo,
          (
            SELECT COUNT(*)
            FROM turnos t
            INNER JOIN estados_turno et ON t.id_estado = et.id_estado
            WHERE t.id_cancha = c.id_cancha
              AND et.nombre <> 'cancelado'
              AND YEARWEEK(t.fecha, 1) = YEARWEEK(CURDATE(), 1)
          ) AS turnos_semana
       FROM canchas c
       WHERE c.id_club = ?
       ORDER BY c.nombre ASC`,
      [idClub]
    );

    res.json(rows);

  } catch (error) {
    console.error('Error en /club/mis-canchas:', error);
    res.status(500).json({ message: 'Error al obtener las canchas' });
  }
});
 
 
// ------------------ Editar cancha ------------------
app.put('/canchas/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, foto, precio, precio_nocturno } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }

  try {
    if (!(await verificarDuenoDeCancha(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      'UPDATE canchas SET nombre = ?, tipo = ?, foto = ?, precio = ?, precio_nocturno = ? WHERE id_cancha = ?',
      [nombre, tipo || null, foto || null, precio || null, precio_nocturno || null, id]
    );
 
    conn.release();
    res.json({ message: 'Cancha actualizada correctamente' });
 
  } catch (error) {
    console.error('Error al editar cancha:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
 
// ------------------ Activar / Desactivar cancha ------------------
app.put('/canchas/:id/estado', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) {
    return res.status(400).json({ message: 'Falta el estado' });
  }

  try {
    if (!(await verificarDuenoDeCancha(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      'UPDATE canchas SET estado = ? WHERE id_cancha = ?',
      [estado, id]
    );
 
    conn.release();
    res.json({ message: 'Estado actualizado correctamente' });
 
  } catch (error) {
    console.error('Error al cambiar estado de cancha:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
 
 
// ------------------ Eliminar cancha ------------------
// Baja lógica: nunca se borra la fila, solo se marca activo = 0. Los turnos
// ya jugados en esta cancha siguen intactos para las estadísticas del club;
// la cancha simplemente deja de listarse para reservar o gestionar.
app.delete('/canchas/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    if (!(await verificarDuenoDeCancha(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    const [result] = await conn.execute('UPDATE canchas SET activo = 0 WHERE id_cancha = ?', [id]);

    conn.release();

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cancha no encontrada' });
    }

    res.json({ message: 'Cancha eliminada correctamente' });

  } catch (error) {
    console.error('Error al eliminar cancha:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Reactivar una cancha dada de baja ------------------
app.put('/canchas/:id/reactivar', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    if (!(await verificarDuenoDeCancha(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [result] = await pool.execute('UPDATE canchas SET activo = 1 WHERE id_cancha = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cancha no encontrada' });
    }

    res.json({ message: 'Cancha reactivada correctamente' });

  } catch (error) {
    console.error('Error al reactivar la cancha:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Disponibilidad de horarios de una cancha en una fecha (vista pública) ------------------
// El cliente elige hora de inicio + duración (60/90/120 min); las combinaciones
// posibles se calculan a partir del horario de atención del club ese día,
// descartando las que se solapen con turnos ya activos.
const DURACIONES_TURNO_MIN = [60, 90, 120];
const INCREMENTO_INICIO_MIN = 30;

function horaAMinutos(hhmmss) {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + m;
}
function minutosAHora(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}
function rangosSeSuperponen(aInicio, aFin, bInicio, bFin) {
  return aInicio < bFin && bInicio < aFin;
}

// Precio por hora de un turno según su hora de inicio: si el club tiene
// configurado un horario nocturno y la cancha tiene precio nocturno propio,
// se cobra ese precio cuando el turno arranca en ese horario o después
// (el precio de todo el turno se define por su hora de inicio, no se
// prorratea aunque el turno termine más tarde).
function precioPorHoraSegunHorario(horaInicioMin, precioDia, precioNoche, horaInicioNocturno) {
  if (!precioNoche || !horaInicioNocturno) return Number(precioDia);

  const corteMin = horaAMinutos(horaInicioNocturno);
  return horaInicioMin >= corteMin ? Number(precioNoche) : Number(precioDia);
}

app.get('/canchas/:id/disponibilidad', async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query;

  if (!fecha) {
    return res.status(400).json({ message: 'Falta la fecha' });
  }

  try {
    const [diaRows] = await pool.execute(
      `SELECT cda.hora_apertura, cda.hora_cierre, c.precio, c.precio_nocturno, cl.hora_inicio_nocturno
       FROM canchas c
       INNER JOIN club cl ON cl.id_club = c.id_club
       INNER JOIN club_dias_atencion cda ON cda.id_club = c.id_club AND cda.numero_dia = WEEKDAY(?)
       WHERE c.id_cancha = ? AND c.activo = 1`,
      [fecha, id]
    );

    if (diaRows.length === 0) {
      return res.json({ abierto: false, horarios: [] });
    }

    const { hora_apertura, hora_cierre, precio, precio_nocturno, hora_inicio_nocturno } = diaRows[0];

    const [turnosActivos] = await pool.execute(
      `SELECT h.hora_inicio, h.hora_fin
       FROM turnos t
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE t.id_cancha = ? AND t.fecha = ?
         AND et.nombre <> 'cancelado'
         AND NOT (et.nombre = 'pendiente_pago' AND t.fecha_creacion <= NOW() - INTERVAL ? MINUTE)`,
      [id, fecha, MINUTOS_ESPERA_PAGO]
    );

    const [[{ esHoy, ahora }]] = [
      (await pool.query('SELECT (? = CURDATE()) AS esHoy, CURTIME() AS ahora', [fecha]))[0]
    ];

    const apertura = horaAMinutos(hora_apertura);
    const cierre = horaAMinutos(hora_cierre);
    const minutosAhora = esHoy ? horaAMinutos(ahora) : null;

    const ocupados = turnosActivos.map((t) => ({
      inicio: horaAMinutos(t.hora_inicio),
      fin: horaAMinutos(t.hora_fin)
    }));

    const horarios = [];
    for (let inicio = apertura; inicio < cierre; inicio += INCREMENTO_INICIO_MIN) {
      if (minutosAhora !== null && inicio <= minutosAhora) continue;

      for (const duracion of DURACIONES_TURNO_MIN) {
        const fin = inicio + duracion;
        if (fin > cierre) continue;

        const disponible = !ocupados.some((o) => rangosSeSuperponen(inicio, fin, o.inicio, o.fin));

        horarios.push({
          hora_inicio: minutosAHora(inicio),
          hora_fin: minutosAHora(fin),
          minutos: duracion,
          disponible,
          precio_hora: precioPorHoraSegunHorario(inicio, precio, precio_nocturno, hora_inicio_nocturno)
        });
      }
    }

    res.json({ abierto: true, hora_apertura, hora_cierre, horarios });

  } catch (error) {
    console.error('Error en /canchas/:id/disponibilidad:', error);
    res.status(500).json({ message: 'Error al obtener la disponibilidad' });
  }
});

// ------------------ Reservar un turno (cliente) ------------------
// Crea el turno en estado "pendiente_pago" (retiene el horario) y devuelve
// el link de pago de Mercado Pago para la seña. El turno pasa a "reservado"
// recién cuando el pago se confirma (ver /pagos/estado/:idTurno y el webhook).
app.post('/turnos', verificarToken, async (req, res) => {
  const { id_cancha, fecha, hora_inicio, minutos } = req.body;

  if (!id_cancha || !fecha || !hora_inicio || !minutos) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }
  if (!DURACIONES_TURNO_MIN.includes(Number(minutos))) {
    return res.status(400).json({ message: 'Duración de turno inválida' });
  }

  try {
    const [usuarioRows] = await pool.execute(
      'SELECT nombre, apellido, dni, telefono FROM usuarios WHERE id_usuario = ?',
      [req.usuario.id]
    );
    const perfil = usuarioRows[0] || {};
    if (!perfil.nombre || !perfil.apellido || !perfil.dni || !perfil.telefono) {
      return res.status(400).json({
        message: 'Completá tu perfil (nombre, apellido, DNI y teléfono) antes de reservar',
        perfilIncompleto: true
      });
    }

    const [fechaValida] = await pool.execute('SELECT ? >= CURDATE() AS valida', [fecha]);
    if (!fechaValida[0].valida) {
      return res.status(400).json({ message: 'No se puede reservar una fecha pasada' });
    }

    const [canchaRows] = await pool.execute(
      `SELECT c.estado, c.activo, c.precio, c.precio_nocturno, c.nombre AS nombre_cancha,
              cl.id_club, cl.nombre AS nombre_club, cl.hora_inicio_nocturno
       FROM canchas c INNER JOIN club cl ON c.id_club = cl.id_club
       WHERE c.id_cancha = ?`,
      [id_cancha]
    );

    if (canchaRows.length === 0 || !canchaRows[0].activo) {
      return res.status(404).json({ message: 'La cancha no existe' });
    }
    if (canchaRows[0].estado !== 'disponible') {
      return res.status(400).json({ message: 'Esta cancha no está disponible actualmente' });
    }
    if (!canchaRows[0].precio) {
      return res.status(400).json({ message: 'Esta cancha todavía no tiene un precio configurado' });
    }

    const idClub = canchaRows[0].id_club;

    const [diaRows] = await pool.execute(
      `SELECT hora_apertura, hora_cierre FROM club_dias_atencion WHERE id_club = ? AND numero_dia = WEEKDAY(?)`,
      [idClub, fecha]
    );
    if (diaRows.length === 0) {
      return res.status(400).json({ message: 'El club no atiende ese día' });
    }

    const inicioMin = horaAMinutos(hora_inicio);
    const finMin = inicioMin + Number(minutos);
    const aperturaMin = horaAMinutos(diaRows[0].hora_apertura);
    const cierreMin = horaAMinutos(diaRows[0].hora_cierre);

    if (inicioMin < aperturaMin || finMin > cierreMin) {
      return res.status(400).json({ message: 'Ese horario está fuera de la atención del club' });
    }

    const [validezHoy] = await pool.execute(
      'SELECT (? = CURDATE() AND ? <= CURTIME()) AS yaPaso',
      [fecha, hora_inicio]
    );
    if (validezHoy[0].yaPaso) {
      return res.status(400).json({ message: 'Ese horario ya pasó' });
    }

    const horaFin = minutosAHora(finMin);

    const [turnosActivos] = await pool.execute(
      `SELECT h.hora_inicio, h.hora_fin
       FROM turnos t
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE t.id_cancha = ? AND t.fecha = ?
         AND et.nombre <> 'cancelado'
         AND NOT (et.nombre = 'pendiente_pago' AND t.fecha_creacion <= NOW() - INTERVAL ? MINUTE)`,
      [id_cancha, fecha, MINUTOS_ESPERA_PAGO]
    );

    const hayChoque = turnosActivos.some((t) =>
      rangosSeSuperponen(inicioMin, finMin, horaAMinutos(t.hora_inicio), horaAMinutos(t.hora_fin))
    );

    if (hayChoque) {
      return res.status(409).json({ message: 'Ese horario ya está reservado, elegí otro' });
    }

    // Buscamos o creamos la franja horaria puntual (hora_inicio - hora_fin) para este club
    const [horarioExistente] = await pool.execute(
      'SELECT id_horario FROM horarios WHERE id_club = ? AND hora_inicio = ? AND hora_fin = ?',
      [idClub, hora_inicio, horaFin]
    );

    let idHorario;
    if (horarioExistente.length > 0) {
      idHorario = horarioExistente[0].id_horario;
    } else {
      const [nuevoHorario] = await pool.execute(
        'INSERT INTO horarios (id_club, hora_inicio, hora_fin) VALUES (?, ?, ?)',
        [idClub, hora_inicio, horaFin]
      );
      idHorario = nuevoHorario.insertId;
    }

    const [result] = await pool.execute(
      `INSERT INTO turnos (id_usuario, id_cancha, id_horario, id_estado, fecha, fecha_creacion)
       VALUES (?, ?, ?, (SELECT id_estado FROM estados_turno WHERE nombre = 'pendiente_pago'), ?, NOW())`,
      [req.usuario.id, id_cancha, idHorario, fecha]
    );
    const idTurno = result.insertId;

    // El precio de la cancha es por hora; se escala según la duración elegida.
    // Si el turno arranca en el horario nocturno del club, se cobra el
    // precio nocturno de la cancha (si tiene uno configurado) en vez del
    // precio de día para todo el turno.
    const precioHora = precioPorHoraSegunHorario(
      inicioMin,
      canchaRows[0].precio,
      canchaRows[0].precio_nocturno,
      canchaRows[0].hora_inicio_nocturno
    );
    const precioTotal = precioHora * (Number(minutos) / 60);
    const montoSena = Math.round(precioTotal * PORCENTAJE_SENA);

    await pool.execute(
      'INSERT INTO pagos (id_turno, id_metodo, monto, estado) VALUES (?, ?, ?, ?)',
      [idTurno, ID_METODO_MERCADOPAGO, montoSena, 'pendiente']
    );

    if (!mpClient) {
      return res.status(201).json({
        message: 'Turno creado, pero los pagos no están configurados en el servidor',
        id_turno: idTurno,
        monto_sena: montoSena,
        init_point: null
      });
    }

    const expiraEn = new Date(Date.now() + MINUTOS_ESPERA_PAGO * 60000).toISOString();

    const preference = new Preference(mpClient);
    const resultadoPreferencia = await preference.create({
      body: {
        items: [{
          title: `Seña - ${canchaRows[0].nombre_club} - ${canchaRows[0].nombre_cancha}`,
          quantity: 1,
          unit_price: montoSena,
          currency_id: 'ARS'
        }],
        external_reference: String(idTurno),
        back_urls: {
          success: `${process.env.FRONTEND_URL}/reserva-confirmacion?turno=${idTurno}`,
          failure: `${process.env.FRONTEND_URL}/reserva-confirmacion?turno=${idTurno}`,
          pending: `${process.env.FRONTEND_URL}/reserva-confirmacion?turno=${idTurno}`
        },
        ...(FRONTEND_URL_ES_PUBLICA ? { auto_return: 'approved' } : {}),
        expires: true,
        expiration_date_to: expiraEn,
        ...(process.env.MP_WEBHOOK_URL ? { notification_url: process.env.MP_WEBHOOK_URL } : {})
      }
    });

    res.status(201).json({
      message: 'Turno creado, falta completar el pago de la seña',
      id_turno: idTurno,
      monto_sena: montoSena,
      expira_en: expiraEn,
      init_point: resultadoPreferencia.init_point || resultadoPreferencia.sandbox_init_point
    });

  } catch (error) {
    console.error('Error al reservar turno:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Estado del pago de un turno (la pantalla de retorno lo consulta) ------------------
app.get('/pagos/estado/:idTurno', verificarToken, async (req, res) => {
  const { idTurno } = req.params;

  try {
    const [turnoRows] = await pool.execute('SELECT id_usuario FROM turnos WHERE id_turno = ?', [idTurno]);
    if (turnoRows.length === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }
    if (Number(req.usuario.rol) !== 1 && turnoRows[0].id_usuario !== req.usuario.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const resultado = await sincronizarPagoDeTurno(idTurno);
    res.json(resultado);

  } catch (error) {
    console.error('Error en /pagos/estado:', error);
    res.status(500).json({ message: 'Error al consultar el estado del pago' });
  }
});

// ------------------ Webhook de Mercado Pago ------------------
// MP notifica acá cuando cambia el estado de un pago. No requiere autenticación
// de usuario (la llama Mercado Pago, no el navegador del cliente).
app.post('/pagos/webhook', async (req, res) => {
  try {
    const tipo = req.query.type || req.body?.type;
    const idNotificado = req.query['data.id'] || req.body?.data?.id;

    if (tipo === 'payment' && idNotificado && mpClient) {
      const paymentClient = new Payment(mpClient);
      const pago = await paymentClient.get({ id: idNotificado });
      if (pago.external_reference) {
        await sincronizarPagoDeTurno(pago.external_reference);
      }
    }

    if (tipo === 'subscription_preapproval' && idNotificado && mpClient) {
      // Puede ser un registro de club todavía pendiente...
      const [pendientes] = await pool.execute(
        'SELECT id_registro FROM registros_club_pendientes WHERE mp_preapproval_id = ?',
        [idNotificado]
      );

      // ...o un cambio de plan pendiente de un club ya activo...
      const [clubesConCambioPendiente] = pendientes.length > 0
        ? [[]]
        : await pool.execute('SELECT id_club FROM club WHERE mp_preapproval_pendiente_id = ?', [idNotificado]);

      if (pendientes.length > 0) {
        await sincronizarRegistroClubPendiente(pendientes[0].id_registro);
      } else if (clubesConCambioPendiente.length > 0) {
        await sincronizarCambioPlanClub(clubesConCambioPendiente[0].id_club);
      } else {
        // ...o un club ya activo cuya suscripción cambió de estado (pausada/cancelada).
        const preapprovalClient = new PreApproval(mpClient);
        const preapproval = await preapprovalClient.get({ id: idNotificado });
        const estadoSuscripcion = preapproval.status === 'authorized' ? 'activa'
          : preapproval.status === 'paused' ? 'pausada'
          : preapproval.status === 'cancelled' ? 'cancelada'
          : null;

        if (estadoSuscripcion) {
          const proximaFechaPago = preapproval.next_payment_date
            ? preapproval.next_payment_date.slice(0, 10)
            : null;
          await pool.execute(
            'UPDATE club SET estado_suscripcion = ?, proxima_fecha_pago = ? WHERE mp_preapproval_id = ?',
            [estadoSuscripcion, proximaFechaPago, idNotificado]
          );
        }
      }
    }

    // Cada cobro real de una cuota mensual de un plan (no el alta/baja de la
    // suscripción, sino cada pago que se le hace efectivamente al club).
    // Lo guardamos para poder mostrar ingreso REAL acumulado, no una
    // proyección en base a precio de plan x clubes activos.
    if (tipo === 'subscription_authorized_payment' && idNotificado && mpClient) {
      const invoiceClient = new Invoice(mpClient);
      const invoice = await invoiceClient.get({ id: idNotificado });

      if (invoice.payment?.status === 'approved' && invoice.preapproval_id && invoice.transaction_amount) {
        const [clubRows] = await pool.execute(
          'SELECT id_club FROM club WHERE mp_preapproval_id = ?',
          [invoice.preapproval_id]
        );

        if (clubRows.length > 0) {
          await pool.execute(
            `INSERT INTO pagos_planes (id_club, mp_invoice_id, monto, fecha)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE monto = monto`,
            [
              clubRows[0].id_club,
              String(invoice.id),
              invoice.transaction_amount,
              invoice.date_created ? new Date(invoice.date_created) : new Date()
            ]
          );

          // Un cobro exitoso confirma que la suscripción sigue vigente y nos
          // dice cuándo es el próximo pago. Sin esto, proxima_fecha_pago
          // nunca avanza después del alta y el club terminaría marcado como
          // "en mora" aunque esté pagando bien.
          const preapprovalClient = new PreApproval(mpClient);
          const preapproval = await preapprovalClient.get({ id: invoice.preapproval_id });
          const proximaFechaPago = preapproval.next_payment_date
            ? preapproval.next_payment_date.slice(0, 10)
            : null;

          await pool.execute(
            `UPDATE club SET estado_suscripcion = 'activa', proxima_fecha_pago = ? WHERE id_club = ?`,
            [proximaFechaPago, clubRows[0].id_club]
          );
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error en webhook de Mercado Pago:', error);
    res.sendStatus(200); // Le confirmamos igual a MP para que no siga reintentando
  }
});


// ------------------ Turnos de una cancha específica (vista del club) ------------------
app.get('/club/turnos-cancha', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_cancha } = req.query;

  if (!id_cancha) {
    return res.status(400).json({ message: 'Falta id_cancha' });
  }

  try {
    if (!(await verificarDuenoDeCancha(req, id_cancha))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT
          t.id_turno,
          t.fecha,
          h.hora_inicio,
          h.hora_fin,
          u.nombre AS cliente_nombre,
          u.apellido AS cliente_apellido,
          u.telefono AS cliente_telefono,
          e.nombre AS estado
       FROM turnos t
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       INNER JOIN estados_turno e ON t.id_estado = e.id_estado
       WHERE t.id_cancha = ?
       ORDER BY t.fecha DESC, h.hora_inicio ASC`,
      [id_cancha]
    );
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /club/turnos-cancha:', error);
    res.status(500).json({ message: 'Error al obtener los turnos' });
  }
});

app.get('/club/turnos-cliente', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_usuario } = req.query;
  const idDueno = Number(req.usuario.rol) === 1 ? req.query.id_dueno : req.usuario.id;

  if (!id_usuario || !idDueno) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  try {
    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      `SELECT
          t.id_turno,
          t.fecha,
          h.hora_inicio,
          h.hora_fin,
          c.nombre AS cancha,
          e.nombre AS estado
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno e ON t.id_estado = e.id_estado
       WHERE t.id_usuario = ? AND cl.id_dueno = ?
       ORDER BY t.fecha DESC, h.hora_inicio ASC`,
      [id_usuario, idDueno]
    );
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /club/turnos-cliente:', error);
    res.status(500).json({ message: 'Error al obtener los turnos del cliente' });
  }
});

app.get('/club/resumen', verificarToken, requireRol(1, 2), async (req, res) => {
  const id_dueno = Number(req.usuario.rol) === 1 ? req.query.id_dueno : req.usuario.id;

  if (!id_dueno) {
    return res.status(400).json({ error: 'Falta id_dueno' });
  }

  try {
    // Datos del club
    const [clubRows] = await pool.query(
      `SELECT id_club, nombre, plan, estado_suscripcion, proxima_fecha_pago FROM club WHERE id_dueno = ?`,
      [id_dueno]
    );
 
    if (clubRows.length === 0) {
      return res.status(404).json({ error: 'No se encontró un club para este usuario' });
    }
 
    const club = clubRows[0];
    const idClub = club.id_club;
 
    // Canchas: total y cuántas están activas (disponibles)
    const [canchasRows] = await pool.query(
      `SELECT
          COUNT(*) AS total_canchas,
          SUM(estado = 'disponible') AS canchas_activas
       FROM canchas
       WHERE id_club = ? AND activo = 1`,
      [idClub]
    );
 
    // Turnos reservados para hoy
    const [turnosHoyRows] = await pool.query(
      `SELECT COUNT(*) AS turnos_hoy
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE c.id_club = ? AND t.fecha = CURDATE() AND et.nombre = 'reservado'`,
      [idClub]
    );
 
    // Turnos reservados en la semana actual (lunes a domingo)
    const [turnosSemanaRows] = await pool.query(
      `SELECT COUNT(*) AS turnos_semana
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE c.id_club = ?
         AND et.nombre = 'reservado'
         AND YEARWEEK(t.fecha, 1) = YEARWEEK(CURDATE(), 1)`,
      [idClub]
    );
 
    // Clientes distintos que reservaron alguna vez en el club
    const [clientesRows] = await pool.query(
      `SELECT COUNT(DISTINCT t.id_usuario) AS total_clientes
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       WHERE c.id_club = ?`,
      [idClub]
    );

    // Ingreso real del mes (seña + resto cobrado), mismo cálculo que el
    // resumen descargable, para mostrarlo de una sin tener que descargar nada.
    const { ingresos } = await calcularResumenClub(idClub, 'mes');

    res.json({
      nombre_club: club.nombre,
      plan: club.plan,
      estado_suscripcion: club.estado_suscripcion,
      proxima_fecha_pago: club.proxima_fecha_pago,
      total_canchas: canchasRows[0].total_canchas || 0,
      canchas_activas: Number(canchasRows[0].canchas_activas) || 0,
      turnos_hoy: turnosHoyRows[0].turnos_hoy || 0,
      turnos_semana: turnosSemanaRows[0].turnos_semana || 0,
      total_clientes: clientesRows[0].total_clientes || 0,
      ingresos_mes: ingresos.total
    });
 
  } catch (error) {
    console.error('Error en /club/resumen:', error);
    res.status(500).json({ error: 'Error al obtener el resumen del club' });
  }
});

// ------------------ Balance histórico del club, mes a mes: lo que ingresó por turnos vs. lo que pagó de plan ------------------
async function obtenerBalanceMensualClub(idClub) {
  const [pagosTurnos] = await pool.query(
    `SELECT p.monto, p.resto_pagado_en, DATE_FORMAT(t.fecha, '%Y-%m') AS periodo
     FROM pagos p
     INNER JOIN turnos t ON p.id_turno = t.id_turno
     INNER JOIN canchas c ON t.id_cancha = c.id_cancha
     WHERE c.id_club = ? AND p.estado = 'pagado'`,
    [idClub]
  );

  const ingresosPorMes = {};
  for (const pago of pagosTurnos) {
    const periodo = pago.periodo;
    const monto = Number(pago.monto);
    let ingreso = monto;
    if (pago.resto_pagado_en) {
      const precioTotal = monto / PORCENTAJE_SENA;
      ingreso += precioTotal - monto;
    }
    ingresosPorMes[periodo] = (ingresosPorMes[periodo] || 0) + ingreso;
  }

  const [pagosPlanes] = await pool.query(
    `SELECT monto, DATE_FORMAT(fecha, '%Y-%m') AS periodo FROM pagos_planes WHERE id_club = ?`,
    [idClub]
  );

  const gastosPorMes = {};
  for (const pago of pagosPlanes) {
    const periodo = pago.periodo;
    gastosPorMes[periodo] = (gastosPorMes[periodo] || 0) + Number(pago.monto);
  }

  const periodos = new Set([...Object.keys(ingresosPorMes), ...Object.keys(gastosPorMes)]);
  const meses = [...periodos].sort().reverse().map((periodo) => {
    const ingreso_turnos = ingresosPorMes[periodo] || 0;
    const gasto_plan = gastosPorMes[periodo] || 0;
    return { periodo, ingreso_turnos, gasto_plan, balance: ingreso_turnos - gasto_plan };
  });

  const totales = meses.reduce(
    (acc, m) => ({
      ingreso_turnos: acc.ingreso_turnos + m.ingreso_turnos,
      gasto_plan: acc.gasto_plan + m.gasto_plan
    }),
    { ingreso_turnos: 0, gasto_plan: 0 }
  );

  return {
    meses,
    totalIngresoTurnos: totales.ingreso_turnos,
    totalGastoPlan: totales.gasto_plan,
    balanceTotal: totales.ingreso_turnos - totales.gasto_plan
  };
}

app.get('/club/balance-mensual', verificarToken, requireRol(1, 2), async (req, res) => {
  const id_dueno = Number(req.usuario.rol) === 1 ? req.query.id_dueno : req.usuario.id;

  if (!id_dueno) {
    return res.status(400).json({ error: 'Falta id_dueno' });
  }

  try {
    const [clubRows] = await pool.query('SELECT id_club FROM club WHERE id_dueno = ?', [id_dueno]);
    if (clubRows.length === 0) {
      return res.status(404).json({ error: 'No se encontró un club para este usuario' });
    }

    const { meses, totalIngresoTurnos, totalGastoPlan, balanceTotal } = await obtenerBalanceMensualClub(clubRows[0].id_club);

    res.json({
      meses,
      total_ingreso_turnos: totalIngresoTurnos,
      total_gasto_plan: totalGastoPlan,
      balance_total: balanceTotal
    });
  } catch (error) {
    console.error('Error en /club/balance-mensual:', error);
    res.status(500).json({ error: 'Error al obtener el balance del club' });
  }
});

// ------------------ Balance mensual del club, en Excel real (con formato y data bars) ------------------
app.get('/club/balance-mensual/excel', verificarToken, requireRol(1, 2), async (req, res) => {
  const id_dueno = Number(req.usuario.rol) === 1 ? req.query.id_dueno : req.usuario.id;

  if (!id_dueno) {
    return res.status(400).json({ error: 'Falta id_dueno' });
  }

  try {
    const [clubRows] = await pool.query('SELECT id_club, nombre FROM club WHERE id_dueno = ?', [id_dueno]);
    if (clubRows.length === 0) {
      return res.status(404).json({ error: 'No se encontró un club para este usuario' });
    }
    const { id_club: idClub, nombre: nombreClub } = clubRows[0];

    const { meses, totalIngresoTurnos, totalGastoPlan, balanceTotal } = await obtenerBalanceMensualClub(idClub);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SUP - Sale un Padel';
    workbook.created = new Date();

    const hojaResumen = workbook.addWorksheet('Resumen');
    hojaResumen.columns = [{ width: 30 }, { width: 22 }];
    hojaResumen.mergeCells('A1:B1');
    hojaResumen.getCell('A1').value = `Mi Balance - ${nombreClub}`;
    hojaResumen.getCell('A1').font = { bold: true, size: 16, color: { argb: COLOR_ENCABEZADO } };
    hojaResumen.addRow([]);

    const filaEncabezadoResumen = hojaResumen.addRow(['Indicador', 'Valor']);
    estiloEncabezado(filaEncabezadoResumen);

    const filaIngreso = hojaResumen.addRow(['Ingreso total por turnos', totalIngresoTurnos]);
    filaIngreso.getCell(2).numFmt = '$#,##0';
    filaIngreso.getCell(2).font = { color: { argb: 'FF1B7A3D' }, bold: true };

    const filaGasto = hojaResumen.addRow(['Gasto total en plan', totalGastoPlan]);
    filaGasto.getCell(2).numFmt = '$#,##0';
    filaGasto.getCell(2).font = { color: { argb: 'FFC62828' }, bold: true };

    const filaBalance = hojaResumen.addRow(['Balance neto acumulado', balanceTotal]);
    filaBalance.getCell(2).numFmt = '$#,##0';
    filaBalance.getCell(2).font = { color: { argb: balanceTotal >= 0 ? 'FF1B7A3D' : 'FFC62828' }, bold: true };

    const hojaMeses = workbook.addWorksheet('Balance mensual');
    hojaMeses.columns = [
      { header: 'Mes', key: 'mes', width: 20 },
      { header: 'Ingreso por turnos', key: 'ingreso', width: 20 },
      { header: 'Gasto por plan', key: 'gasto', width: 20 },
      { header: 'Balance', key: 'balance', width: 20 }
    ];
    estiloEncabezado(hojaMeses.getRow(1));
    hojaMeses.autoFilter = { from: 'A1', to: 'D1' };
    hojaMeses.views = [{ state: 'frozen', ySplit: 1 }];

    for (const m of meses) {
      const fila = hojaMeses.addRow({
        mes: formatearPeriodoLargo(m.periodo),
        ingreso: m.ingreso_turnos,
        gasto: m.gasto_plan,
        balance: m.balance
      });
      fila.getCell('ingreso').numFmt = '$#,##0';
      fila.getCell('gasto').numFmt = '$#,##0';
      fila.getCell('balance').numFmt = '$#,##0';
      fila.getCell('balance').font = { color: { argb: m.balance >= 0 ? 'FF1B7A3D' : 'FFC62828' }, bold: true };
    }

    if (meses.length > 0) {
      const ultimaFila = meses.length + 1;
      hojaMeses.addConditionalFormatting({
        ref: `B2:B${ultimaFila}`,
        rules: [
          {
            type: 'dataBar',
            minLength: 0,
            maxLength: 100,
            gradient: true,
            border: true,
            negativeBarColorSameAsPositive: false,
            negativeBarBorderColorSameAsPositive: true,
            axisPosition: 'automatic',
            direction: 'leftToRight',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: 'FF1B7A3D' }
          }
        ]
      });
      hojaMeses.addConditionalFormatting({
        ref: `C2:C${ultimaFila}`,
        rules: [
          {
            type: 'dataBar',
            minLength: 0,
            maxLength: 100,
            gradient: true,
            border: true,
            negativeBarColorSameAsPositive: false,
            negativeBarBorderColorSameAsPositive: true,
            axisPosition: 'automatic',
            direction: 'leftToRight',
            cfvo: [{ type: 'min' }, { type: 'max' }],
            color: { argb: 'FFC62828' }
          }
        ]
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="mi-balance-${nombreClub.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error en /club/balance-mensual/excel:', error);
    res.status(500).json({ error: 'Error al generar el Excel' });
  }
});

// ------------------ Turnos reservados de hoy o de esta semana, con búsqueda y paginado real ------------------
// La semana es lunes a domingo (YEARWEEK con modo 1), igual que turnos_semana
// de /club/resumen.
app.get('/club/turnos-periodo', verificarToken, requireRol(1, 2), async (req, res) => {
  const id_dueno = Number(req.usuario.rol) === 1 ? req.query.id_dueno : req.usuario.id;

  if (!id_dueno) {
    return res.status(400).json({ message: 'Falta id_dueno' });
  }

  try {
    const [clubRows] = await pool.query('SELECT id_club FROM club WHERE id_dueno = ?', [id_dueno]);
    if (clubRows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un club para este usuario' });
    }
    const idClub = clubRows[0].id_club;

    const periodo = ['hoy', 'semana'].includes(req.query.periodo) ? req.query.periodo : 'todos';
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || '') ? req.query.fecha : null;
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(50, Math.max(1, parseInt(req.query.limite) || 10));
    const offset = (pagina - 1) * limite;
    const busqueda = (req.query.busqueda || '').trim();

    const condiciones = ['c.id_club = ?'];
    const params = [idClub];

    // Un día puntual (vista calendario) pisa el filtro por período: se
    // muestran todos los turnos de ese día sin importar el estado.
    if (fecha) {
      condiciones.push('t.fecha = ?');
      params.push(fecha);
    } else if (periodo === 'hoy') {
      // "hoy"/"semana" son los contadores operativos (solo lo confirmado
      // para ese rango). "todos" es el historial completo del club:
      // pasados, presentes y futuros, sin importar el estado.
      condiciones.push("et.nombre = 'reservado'", 't.fecha = CURDATE()');
    } else if (periodo === 'semana') {
      condiciones.push("et.nombre = 'reservado'", 'YEARWEEK(t.fecha, 1) = YEARWEEK(CURDATE(), 1)');
    }

    if (busqueda) {
      const like = `%${busqueda}%`;
      condiciones.push('(u.nombre LIKE ? OR u.apellido LIKE ? OR u.usuario LIKE ? OR c.nombre LIKE ?)');
      params.push(like, like, like, like);
    }

    const whereSql = `WHERE ${condiciones.join(' AND ')}`;
    // El dueño puede elegir el orden desde la pantalla; si no manda nada,
    // usamos el mismo criterio de siempre según el período.
    const ordenSolicitado = (req.query.orden || '').toLowerCase();
    const orden = ['asc', 'desc'].includes(ordenSolicitado)
      ? ordenSolicitado.toUpperCase()
      : (periodo === 'todos' ? 'DESC' : 'ASC');

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM turnos t
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       ${whereSql}`,
      params
    );
    const total = totalRows[0].total;

    const [rows] = await pool.query(
      `SELECT
          t.id_turno, t.fecha,
          u.nombre, u.apellido, u.usuario, u.telefono,
          c.nombre AS cancha,
          h.hora_inicio, h.hora_fin,
          et.nombre AS estado,
          p.monto AS monto_sena,
          p.resto_pagado_en
       FROM turnos t
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       LEFT JOIN pagos p ON p.id_turno = t.id_turno AND p.estado = 'pagado'
       ${whereSql}
       ORDER BY t.fecha ${orden}, h.hora_inicio ASC
       LIMIT ${limite} OFFSET ${offset}`,
      params
    );

    res.json({
      turnos: rows,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    });

  } catch (error) {
    console.error('Error en /club/turnos-periodo:', error);
    res.status(500).json({ message: 'Error al obtener los turnos' });
  }
});

// ------------------ Cantidad de turnos por día, para pintar el calendario ------------------
app.get('/club/turnos-calendario', verificarToken, requireRol(1, 2), async (req, res) => {
  const id_dueno = Number(req.usuario.rol) === 1 ? req.query.id_dueno : req.usuario.id;

  if (!id_dueno) {
    return res.status(400).json({ message: 'Falta id_dueno' });
  }

  const anio = parseInt(req.query.anio);
  const mes = parseInt(req.query.mes); // 1-12

  if (!anio || !mes || mes < 1 || mes > 12) {
    return res.status(400).json({ message: 'Falta año/mes válidos' });
  }

  try {
    const [clubRows] = await pool.query('SELECT id_club FROM club WHERE id_dueno = ?', [id_dueno]);
    if (clubRows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un club para este usuario' });
    }
    const idClub = clubRows[0].id_club;

    const [rows] = await pool.execute(
      `SELECT t.fecha, COUNT(*) AS cantidad
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       WHERE c.id_club = ? AND YEAR(t.fecha) = ? AND MONTH(t.fecha) = ?
       GROUP BY t.fecha`,
      [idClub, anio, mes]
    );

    const dias = {};
    for (const r of rows) {
      const fechaStr = r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10);
      dias[fechaStr] = r.cantidad;
    }

    res.json({ dias });

  } catch (error) {
    console.error('Error en /club/turnos-calendario:', error);
    res.status(500).json({ message: 'Error al obtener el calendario' });
  }
});

// ------------------ Resumen descargable del club (para el PDF) ------------------
// Todo lo que muestra sale de datos reales: los ingresos son la seña
// (siempre cobrada por Mercado Pago) más el resto solo cuando el club lo
// marcó como cobrado a mano (ver /turnos/:id/marcar-resto-pagado). No se
// estima ni se inventa ningún monto.
function condicionPeriodoResumen(periodo) {
  return periodo === 'anio'
    ? 'AND YEAR(t.fecha) = YEAR(CURDATE())'
    : periodo === 'todo'
      ? ''
      : 'AND YEAR(t.fecha) = YEAR(CURDATE()) AND MONTH(t.fecha) = MONTH(CURDATE())';
}

// Calcula los mismos agregados que ve el dueño del club en pantalla (y que
// se reutilizan para armar tanto la respuesta JSON como el Excel).
async function calcularResumenClub(idClub, periodo) {
  const condicionPeriodo = condicionPeriodoResumen(periodo);

  const [porEstado] = await pool.query(
    `SELECT et.nombre AS estado, COUNT(*) AS cantidad
     FROM turnos t
     INNER JOIN canchas c ON t.id_cancha = c.id_cancha
     INNER JOIN estados_turno et ON t.id_estado = et.id_estado
     WHERE c.id_club = ? ${condicionPeriodo}
     GROUP BY et.nombre`,
    [idClub]
  );

  const [[{ total_clientes }]] = await pool.query(
    `SELECT COUNT(DISTINCT t.id_usuario) AS total_clientes
     FROM turnos t
     INNER JOIN canchas c ON t.id_cancha = c.id_cancha
     WHERE c.id_club = ? ${condicionPeriodo}`,
    [idClub]
  );

  const [canchaTop] = await pool.query(
    `SELECT c.nombre, COUNT(*) AS cantidad
     FROM turnos t
     INNER JOIN canchas c ON t.id_cancha = c.id_cancha
     INNER JOIN estados_turno et ON t.id_estado = et.id_estado
     WHERE c.id_club = ? AND et.nombre <> 'cancelado' ${condicionPeriodo}
     GROUP BY c.id_cancha, c.nombre
     ORDER BY cantidad DESC
     LIMIT 1`,
    [idClub]
  );

  const [pagosRows] = await pool.query(
    `SELECT p.monto, p.resto_pagado_en
     FROM pagos p
     INNER JOIN turnos t ON p.id_turno = t.id_turno
     INNER JOIN canchas c ON t.id_cancha = c.id_cancha
     WHERE c.id_club = ? AND p.estado = 'pagado' ${condicionPeriodo}`,
    [idClub]
  );

  let totalSenas = 0;
  let totalResto = 0;
  for (const pago of pagosRows) {
    const monto = Number(pago.monto);
    totalSenas += monto;
    if (pago.resto_pagado_en) {
      // La seña es un % fijo del precio total (PORCENTAJE_SENA); el resto
      // es lo que falta para llegar a ese total.
      const precioTotal = monto / PORCENTAJE_SENA;
      totalResto += precioTotal - monto;
    }
  }

  return {
    turnos_por_estado: porEstado.reduce((acc, r) => ({ ...acc, [r.estado]: r.cantidad }), {}),
    total_clientes: total_clientes || 0,
    cancha_mas_reservada: canchaTop[0] || null,
    ingresos: {
      senas: totalSenas,
      resto_cobrado: totalResto,
      total: totalSenas + totalResto
    }
  };
}

const NOMBRES_PERIODO_EXCEL = { mes: 'Este mes', anio: 'Este año', todo: 'Todo' };
const COLOR_ENCABEZADO = 'FF0D3B66';

function estiloEncabezado(fila) {
  fila.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO } };
    celda.alignment = { vertical: 'middle', horizontal: 'left' };
  });
}

// ------------------ Resumen del club, en Excel real (con formato) ------------------
app.get('/club/resumen-descargable/excel', verificarToken, requireRol(2), async (req, res) => {
  const { periodo } = req.query; // 'mes' | 'anio' | 'todo'

  try {
    const [clubRows] = await pool.query('SELECT id_club, nombre FROM club WHERE id_dueno = ?', [req.usuario.id]);
    if (clubRows.length === 0) {
      return res.status(404).json({ message: 'No se encontró un club para este usuario' });
    }
    const idClub = clubRows[0].id_club;
    const nombreClub = clubRows[0].nombre;

    const resumen = await calcularResumenClub(idClub, periodo);
    const condicionPeriodo = condicionPeriodoResumen(periodo);

    const [turnosRows] = await pool.query(
      `SELECT
          t.fecha, h.hora_inicio, h.hora_fin, c.nombre AS cancha,
          u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.telefono AS cliente_telefono,
          et.nombre AS estado, p.monto AS monto_sena, p.resto_pagado_en
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       LEFT JOIN pagos p ON p.id_turno = t.id_turno
       WHERE c.id_club = ? ${condicionPeriodo}
       ORDER BY t.fecha DESC, h.hora_inicio ASC`,
      [idClub]
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SUP - Sale un Padel';
    workbook.created = new Date();

    // ------------------ Hoja 1: Resumen ------------------
    const hojaResumen = workbook.addWorksheet('Resumen');
    hojaResumen.columns = [{ width: 28 }, { width: 22 }];

    hojaResumen.mergeCells('A1:B1');
    hojaResumen.getCell('A1').value = `Resumen de ${nombreClub}`;
    hojaResumen.getCell('A1').font = { bold: true, size: 16, color: { argb: COLOR_ENCABEZADO } };

    hojaResumen.getCell('A2').value = `Período: ${NOMBRES_PERIODO_EXCEL[periodo] || NOMBRES_PERIODO_EXCEL.mes}`;
    hojaResumen.getCell('A2').font = { italic: true, color: { argb: 'FF667085' } };

    hojaResumen.addRow([]); // fila en blanco, separa el título del detalle
    const filaEncabezadoResumen = hojaResumen.addRow(['Indicador', 'Valor']);
    estiloEncabezado(filaEncabezadoResumen);

    const porEstado = resumen.turnos_por_estado;
    const filasResumen = [
      ['Turnos reservados', porEstado.reservado || 0],
      ['Turnos completados', porEstado.completado || 0],
      ['Turnos cancelados', porEstado.cancelado || 0],
      ['Turnos pendientes de pago', porEstado.pendiente_pago || 0],
      ['Clientes distintos', resumen.total_clientes],
      ['Cancha más reservada', resumen.cancha_mas_reservada ? `${resumen.cancha_mas_reservada.nombre} (${resumen.cancha_mas_reservada.cantidad} turnos)` : '-'],
      ['Ingreso por señas', resumen.ingresos.senas],
      ['Ingreso por resto cobrado', resumen.ingresos.resto_cobrado],
      ['Ingreso total', resumen.ingresos.total]
    ];

    for (const [indicador, valor] of filasResumen) {
      const fila = hojaResumen.addRow([indicador, valor]);
      if (typeof valor === 'number') {
        fila.getCell(2).numFmt = '$#,##0';
      }
    }

    // ------------------ Hoja 2: Turnos ------------------
    const hojaTurnos = workbook.addWorksheet('Turnos');
    hojaTurnos.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Horario', key: 'horario', width: 16 },
      { header: 'Cancha', key: 'cancha', width: 16 },
      { header: 'Cliente', key: 'cliente', width: 26 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Seña', key: 'sena', width: 14 },
      { header: 'Resto cobrado', key: 'resto', width: 16 }
    ];
    estiloEncabezado(hojaTurnos.getRow(1));
    hojaTurnos.autoFilter = { from: 'A1', to: 'H1' };
    hojaTurnos.views = [{ state: 'frozen', ySplit: 1 }];

    for (const t of turnosRows) {
      const fila = hojaTurnos.addRow({
        fecha: new Date(t.fecha).toLocaleDateString('es-AR'),
        horario: `${t.hora_inicio?.slice(0, 5)} a ${t.hora_fin?.slice(0, 5)}`,
        cancha: t.cancha,
        cliente: `${t.cliente_nombre || ''} ${t.cliente_apellido || ''}`.trim(),
        telefono: t.cliente_telefono || '-',
        estado: t.estado,
        sena: t.monto_sena ? Number(t.monto_sena) : null,
        resto: t.monto_sena ? (t.resto_pagado_en ? 'Sí' : 'No') : '-'
      });
      fila.getCell('sena').numFmt = '$#,##0';
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="resumen-${nombreClub.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Error en /club/resumen-descargable/excel:', error);
    res.status(500).json({ message: 'Error al generar el Excel' });
  }
});

// ------------------ Datos de la cuenta (usuario propio) ------------------
app.get('/usuarios/mi-cuenta', verificarToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT usuario, password FROM usuarios WHERE id_usuario = ?',
      [req.usuario.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json({
      usuario: rows[0].usuario,
      tieneContrasena: !!rows[0].password
    });

  } catch (error) {
    console.error('Error en /usuarios/mi-cuenta:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Actualizar Perfil de Usuario ------------------
app.put('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, dni, correo, telefono, usuario } = req.body;

  if (Number(req.usuario.rol) !== 1 && req.usuario.id !== Number(id)) {
    return res.status(403).json({ message: 'No autorizado' });
  }

  if (!nombre || !apellido || !correo || !usuario) {
    return res.status(400).json({ message: 'Nombre, apellido, usuario y correo son obligatorios' });
  }

  try {
    const conn = await pool.getConnection();

    // Verificar que el usuario existe
    const [existing] = await conn.execute(
      'SELECT * FROM usuarios WHERE id_usuario = ?',
      [id]
    );

    if (existing.length === 0) {
      conn.release();
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar que el correo, dni o nombre de usuario no estén en uso por OTRO usuario
    const [duplicados] = await conn.execute(
      'SELECT id_usuario FROM usuarios WHERE (correo = ? OR dni = ? OR usuario = ?) AND id_usuario != ?',
      [correo, dni || '', usuario, id]
    );

    if (duplicados.length > 0) {
      conn.release();
      return res.status(400).json({ message: 'El correo, DNI o nombre de usuario ya está en uso por otro usuario' });
    }

    await conn.execute(
      `UPDATE usuarios
       SET nombre = ?, apellido = ?, dni = ?, correo = ?, telefono = ?, usuario = ?
       WHERE id_usuario = ?`,
      [nombre, apellido, dni || null, correo, telefono || null, usuario, id]
    );

    const [updatedRows] = await conn.execute(
      'SELECT id_usuario, nombre, apellido, dni, correo, telefono, foto, id_rol FROM usuarios WHERE id_usuario = ?',
      [id]
    );

    conn.release();

    res.json({
      message: 'Perfil actualizado correctamente',
      usuario: updatedRows[0]
    });

  } catch (error) {
    console.error('Error al actualizar usuario:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'El correo o DNI ya está registrado' });
    }

    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.put('/usuarios/:id/password', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { passwordActual, passwordNueva } = req.body;

  if (req.usuario.id !== Number(id)) {
    return res.status(403).json({ message: 'No autorizado' });
  }

  if (!passwordNueva) {
    return res.status(400).json({ message: 'Faltan datos' });
  }

  if (passwordNueva.length < 6) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT password FROM usuarios WHERE id_usuario = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const hashActual = rows[0].password;

    // Cuentas que iniciaron sesión con Google y todavía no tienen contraseña propia:
    // se les permite crear una directamente, sin pedir una "actual" que no existe.
    if (hashActual) {
      if (!passwordActual) {
        return res.status(400).json({ message: 'Faltan datos' });
      }

      const coincide = await bcrypt.compare(passwordActual, hashActual);
      if (!coincide) {
        return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
      }
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, 10);

    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
      [nuevoHash, id]
    );

    res.json({ message: hashActual ? 'Contraseña actualizada correctamente' : 'Contraseña creada correctamente' });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
});


app.put('/turnos/:id/cancelar', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  try {
    const [turnoRows] = await pool.query(
      `SELECT
          t.id_usuario, cl.id_dueno, t.fecha,
          h.hora_inicio, h.hora_fin,
          c.nombre AS nombre_cancha, cl.nombre AS nombre_club,
          u.correo AS correo_cliente, u.nombre AS nombre_cliente
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       WHERE t.id_turno = ?`,
      [id]
    );

    if (turnoRows.length === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const turno = turnoRows[0];
    const { id_usuario: idUsuarioTurno, id_dueno: idDuenoClub } = turno;
    const esElCliente = req.usuario.id === idUsuarioTurno;
    const esDueno = Number(req.usuario.rol) === 1 || esElCliente || req.usuario.id === idDuenoClub;

    if (!esDueno) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    // Si cancela el club (o un admin) en nombre del cliente, le pedimos el motivo
    // para poder avisarle por qué se le canceló el turno.
    if (!esElCliente && !motivo?.trim()) {
      return res.status(400).json({ message: 'Indicá el motivo de la cancelación' });
    }

    const [result] = await pool.query(
      `UPDATE turnos
       SET id_estado = (SELECT id_estado FROM estados_turno WHERE nombre = 'cancelado')
       WHERE id_turno = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    // Si tenía un pago sin completar (seña abandonada), lo limpiamos
    await pool.query("DELETE FROM pagos WHERE id_turno = ? AND estado = 'pendiente'", [id]);

    if (!esElCliente && turno.correo_cliente) {
      enviarEmailCancelacionTurno(turno, motivo.trim()).catch((error) => {
        console.error('Error al enviar el correo de cancelación:', error);
      });
    }

    res.json({ message: 'Turno cancelado correctamente' });

  } catch (error) {
    console.error('Error al cancelar turno:', error);
    res.status(500).json({ message: 'Error al cancelar el turno' });
  }
});

// ------------------ Marcar el resto de un turno como cobrado en el club ------------------
// La seña se cobra siempre por Mercado Pago; el resto lo cobra el club en
// persona (efectivo, transferencia, etc.) y no pasa por la plataforma, así
// que lo confirma el propio club a mano. Esto alimenta el resumen de
// ingresos del club con datos reales en vez de una estimación.
app.put('/turnos/:id/marcar-resto-pagado', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    const [turnoRows] = await pool.query(
      `SELECT cl.id_dueno, p.id_pago, p.estado AS estado_pago, p.resto_pagado_en
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       LEFT JOIN pagos p ON p.id_turno = t.id_turno
       WHERE t.id_turno = ?`,
      [id]
    );

    if (turnoRows.length === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const turno = turnoRows[0];
    const esDueno = Number(req.usuario.rol) === 1 || req.usuario.id === turno.id_dueno;

    if (!esDueno) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    if (!turno.id_pago || turno.estado_pago !== 'pagado') {
      return res.status(400).json({ message: 'Este turno todavía no tiene la seña pagada' });
    }

    if (turno.resto_pagado_en) {
      return res.status(400).json({ message: 'Ya estaba marcado como cobrado' });
    }

    await pool.query('UPDATE pagos SET resto_pagado_en = NOW() WHERE id_pago = ?', [turno.id_pago]);

    res.json({ message: 'Resto marcado como cobrado' });

  } catch (error) {
    console.error('Error al marcar el resto como cobrado:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});
// ------------------ Obtener Turnos de un Usuario ------------------
app.get('/turnos/proximos-count', verificarToken, async (req, res) => {
  const id_usuario = Number(req.usuario.rol) === 1 ? req.query.id_usuario : req.usuario.id;

  if (!id_usuario) {
    return res.status(400).json({ message: 'Falta id_usuario' });
  }

  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      `SELECT
          t.fecha,
          h.hora_inicio,
          cl.nombre AS club
       FROM turnos t
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       INNER JOIN estados_turno e ON t.id_estado = e.id_estado
       WHERE t.id_usuario = ?
         AND e.nombre = 'reservado'
         AND t.fecha BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
       ORDER BY t.fecha ASC, h.hora_inicio ASC`,
      [id_usuario]
    );
 
    conn.release();
 
    res.json({
      count: rows.length,
      proximo: rows.length > 0 ? rows[0] : null
    });
 
  } catch (error) {
    console.error('Error en /turnos/proximos-count:', error);
    res.status(500).json({ message: 'Error al obtener turnos próximos' });
  }
});
app.get('/turnos', verificarToken, async (req, res) => {
  const id_usuario = Number(req.usuario.rol) === 1 ? req.query.id_usuario : req.usuario.id;

  if (!id_usuario) {
    return res.status(400).json({ message: 'Falta id_usuario' });
  }

  try {
    const pagina = Math.max(1, parseInt(req.query.pagina) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(req.query.limite) || 8));
    const offset = (pagina - 1) * limite;
    const estado = req.query.estado;

    const condiciones = ['t.id_usuario = ?'];
    const params = [id_usuario];

    if (estado) {
      condiciones.push('e.nombre = ?');
      params.push(estado);
    }

    const whereSql = `WHERE ${condiciones.join(' AND ')}`;
    // Reservadas: la más próxima primero. Completadas/canceladas: la más
    // reciente primero, como un historial.
    const orden = (estado === 'completado' || estado === 'cancelado') ? 'DESC' : 'ASC';

    const [totalRows] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       INNER JOIN estados_turno e ON t.id_estado = e.id_estado
       ${whereSql}`,
      params
    );
    const total = totalRows[0].total;

    const [rows] = await pool.query(
      `SELECT
          t.id_turno,
          t.fecha,
          h.hora_inicio,
          h.hora_fin,
          c.nombre AS cancha,
          cl.nombre AS club,
          cl.direccion AS direccion,
          cl.telefono AS telefono_club,
          cl.localidad AS localidad_club,
          e.nombre AS estado
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno e ON t.id_estado = e.id_estado
       ${whereSql}
       ORDER BY t.fecha ${orden}, h.hora_inicio ASC
       LIMIT ${limite} OFFSET ${offset}`,
      params
    );

    res.json({
      turnos: rows,
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite))
    });

  } catch (error) {
    console.error('Error en /turnos:', error);
    res.status(500).json({ message: 'Error al obtener turnos' });
  }
});
// ------------------ SERVER ------------------
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});