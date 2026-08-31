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
    console.log('❌ Faltan datos obligatorios:', { nombreClub, correo, usuario, password, canchas });
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }
 
  if (password.length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }
 
  try {
    const conn = await pool.getConnection();
 
    // Verificar duplicados
    const [existingUser] = await conn.execute(
      'SELECT * FROM usuarios WHERE correo = ? OR usuario = ?',
      [correo, usuario]
    );
 
    if (existingUser.length > 0) {
      console.log('❌ Correo o usuario ya existe:', { correo, usuario });
      conn.release();
      return res.status(400).json({ message: 'Correo o usuario ya existe' });
    }
 
    const hashedPassword = await bcrypt.hash(password, 10);
 
    // 1. Crear usuario (dueño del club)
    const [userResult] = await conn.execute(
      'INSERT INTO usuarios (usuario, correo, password, metodo_registro, id_rol) VALUES (?, ?, ?, ?, ?)',
      [usuario, correo, hashedPassword, 'manual', 2] // 2 = dueño club
    );
 
    const idUsuario = userResult.insertId;
 
    // 2. Crear club
    const [clubResult] = await conn.execute(
      `INSERT INTO club (nombre, direccion, provincia, localidad, telefono, id_dueno, plan)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombreClub, direccion, provincia, localidad, nroTitular, idUsuario, plan || 'basico']
    );
 
    const idClub = clubResult.insertId;
 
    // 3. Crear canchas automáticamente
    for (let i = 1; i <= parseInt(canchas); i++) {
      await conn.execute(
        'INSERT INTO canchas (nombre, estado, id_club) VALUES (?, ?, ?)',
        [`Cancha ${i}`, 'disponible', idClub]
      );
    }
 
    conn.release();
    res.status(201).json({ message: 'Club registrado correctamente' });
 
  } catch (error) {
    console.error('Error en registro club:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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

    const conn = await pool.getConnection();

    const [rows] = await conn.execute(
      'SELECT * FROM usuarios WHERE correo = ?',
      [correo]
    );

    let rol = 3;
    let nombreFinal = usuario;
    let fotoFinal = foto;
    let idUsuarioFinal;
    let apellidoFinal = '';
    let dniFinal = '';
    let telefonoFinal = '';

    if (rows.length === 0) {
    const [insertResult] = await conn.execute(
        'INSERT INTO usuarios (usuario, nombre, correo, foto, password, metodo_registro, id_rol) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [usuario, usuario, correo, foto, '', 'google', 3]
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
        SELECT id_usuario, usuario, correo, id_rol
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

app.get('/clubes/populares', async (req, res) => {
  const limite = parseInt(req.query.limit) || 3;
 
  try {
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
      `SELECT
        c.*,
        u.usuario AS dueno,
        (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club) AS cantidad_canchas,
        (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL) AS precio_desde,
        (
          SELECT COUNT(*)
          FROM turnos t
          INNER JOIN canchas ca2 ON t.id_cancha = ca2.id_cancha
          WHERE ca2.id_club = c.id_club
        ) AS total_turnos
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
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
        c.*,
        u.usuario AS dueno,
        (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club) AS cantidad_canchas,
        (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL) AS precio_desde
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
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
        c.*,
        u.usuario AS dueno,
        (SELECT COUNT(*) FROM canchas ca WHERE ca.id_club = c.id_club) AS cantidad_canchas,
        (SELECT MIN(ca.precio) FROM canchas ca WHERE ca.id_club = c.id_club AND ca.precio IS NOT NULL) AS precio_desde
      FROM club c
      LEFT JOIN usuarios u ON c.id_dueno = u.id_usuario
      WHERE c.id_club = ?`,
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

// ------------------ Dar de baja un club (solo admin) ------------------
app.delete('/clubes/:id', verificarToken, requireRol(1), async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.execute('DELETE FROM club WHERE id_club = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Club no encontrado' });
    }

    res.json({ message: 'Club eliminado correctamente' });

  } catch (error) {
    console.error('Error al eliminar club:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({
        message: 'No se puede eliminar: este club tiene canchas, turnos u otros datos asociados.'
      });
    }

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
 
app.put('/club/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  const { nombre, direccion, localidad, telefono, horarios_atencion } = req.body;

  if (!nombre || !direccion || !localidad || !telefono) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      'UPDATE club SET nombre = ?, direccion = ?, localidad = ?, telefono = ?, horarios_atencion = ? WHERE id_club = ?',
      [nombre, direccion, localidad, telefono, horarios_atencion || null, id]
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

// ------------------ Horarios reservables del club ------------------
// (las franjas que sus clientes pueden elegir al reservar un turno; cada
// club define las suyas, con la duración que quiera)

app.get('/club/horarios', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_club } = req.query;
  if (!id_club) return res.status(400).json({ message: 'Falta id_club' });

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [rows] = await pool.execute(
      'SELECT id_horario, hora_inicio, hora_fin FROM horarios WHERE id_club = ? ORDER BY hora_inicio ASC',
      [id_club]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error en /club/horarios:', error);
    res.status(500).json({ message: 'Error al obtener los horarios' });
  }
});

app.post('/club/horarios', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_club, hora_inicio, hora_fin } = req.body;

  if (!id_club || !hora_inicio || !hora_fin) {
    return res.status(400).json({ message: 'Faltan datos' });
  }
  if (hora_inicio >= hora_fin) {
    return res.status(400).json({ message: 'La hora de inicio debe ser anterior a la hora de fin' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const [result] = await pool.execute(
      'INSERT INTO horarios (id_club, hora_inicio, hora_fin) VALUES (?, ?, ?)',
      [id_club, hora_inicio, hora_fin]
    );

    res.status(201).json({ id_horario: result.insertId, hora_inicio, hora_fin });
  } catch (error) {
    console.error('Error al agregar horario:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

app.delete('/club/horarios/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    const [horarioRows] = await pool.execute('SELECT id_club FROM horarios WHERE id_horario = ?', [id]);
    if (horarioRows.length === 0) {
      return res.status(404).json({ message: 'Horario no encontrado' });
    }
    if (!(await verificarDuenoDeClub(req, horarioRows[0].id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    await pool.execute('DELETE FROM horarios WHERE id_horario = ?', [id]);
    res.json({ message: 'Horario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar horario:', error);

    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({
        message: 'No se puede eliminar: este horario tiene turnos asociados.'
      });
    }

    res.status(500).json({ message: 'Error en el servidor' });
  }
});

 // ------------------ Agregar una cancha nueva al club ------------------
app.post('/club/canchas', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id_club, nombre, tipo, foto, precio } = req.body;

  if (!id_club || !nombre) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  try {
    if (!(await verificarDuenoDeClub(req, id_club))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    const [result] = await conn.execute(
      'INSERT INTO canchas (nombre, estado, id_club, tipo, foto, precio) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, 'disponible', id_club, tipo || null, foto || null, precio || null]
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
      [id_club]
    );
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /club/canchas:', error);
    res.status(500).json({ message: 'Error al obtener las canchas' });
  }
});
 
 
// ------------------ Editar cancha ------------------
app.put('/canchas/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;
  const { nombre, tipo, foto, precio } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio' });
  }

  try {
    if (!(await verificarDuenoDeCancha(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    await conn.execute(
      'UPDATE canchas SET nombre = ?, tipo = ?, foto = ?, precio = ? WHERE id_cancha = ?',
      [nombre, tipo || null, foto || null, precio || null, id]
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
app.delete('/canchas/:id', verificarToken, requireRol(1, 2), async (req, res) => {
  const { id } = req.params;

  try {
    if (!(await verificarDuenoDeCancha(req, id))) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const conn = await pool.getConnection();

    await conn.execute('DELETE FROM canchas WHERE id_cancha = ?', [id]);
 
    conn.release();
    res.json({ message: 'Cancha eliminada correctamente' });
 
  } catch (error) {
    console.error('Error al eliminar cancha:', error);
 
    // Si la cancha tiene turnos asociados, MySQL bloquea el borrado por la
    // llave foránea. Le devolvemos un mensaje claro en vez del error crudo.
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({
        message: 'No se puede eliminar: esta cancha tiene turnos asociados. Podés desactivarla en su lugar.'
      });
    }
 
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// ------------------ Disponibilidad de horarios de una cancha en una fecha (vista pública) ------------------
app.get('/canchas/:id/disponibilidad', async (req, res) => {
  const { id } = req.params;
  const { fecha } = req.query;

  if (!fecha) {
    return res.status(400).json({ message: 'Falta la fecha' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT
          h.id_horario,
          h.hora_inicio,
          h.hora_fin,
          (
            EXISTS (
              SELECT 1 FROM turnos t
              INNER JOIN estados_turno et ON t.id_estado = et.id_estado
              WHERE t.id_cancha = ? AND t.id_horario = h.id_horario AND t.fecha = ?
                AND et.nombre <> 'cancelado'
            )
            OR (? = CURDATE() AND h.hora_inicio <= CURTIME())
          ) AS ocupado
       FROM canchas c
       INNER JOIN horarios h ON h.id_club = c.id_club
       WHERE c.id_cancha = ?
       ORDER BY h.hora_inicio ASC`,
      [id, fecha, fecha, id]
    );

    res.json(rows.map((r) => ({ ...r, ocupado: !!r.ocupado })));

  } catch (error) {
    console.error('Error en /canchas/:id/disponibilidad:', error);
    res.status(500).json({ message: 'Error al obtener la disponibilidad' });
  }
});

// ------------------ Reservar un turno (cliente) ------------------
app.post('/turnos', verificarToken, async (req, res) => {
  const { id_cancha, id_horario, fecha } = req.body;

  if (!id_cancha || !id_horario || !fecha) {
    return res.status(400).json({ message: 'Faltan datos obligatorios' });
  }

  try {
    const [fechaValida] = await pool.execute('SELECT ? >= CURDATE() AS valida', [fecha]);
    if (!fechaValida[0].valida) {
      return res.status(400).json({ message: 'No se puede reservar una fecha pasada' });
    }

    const [canchaRows] = await pool.execute(
      'SELECT estado FROM canchas WHERE id_cancha = ?',
      [id_cancha]
    );

    if (canchaRows.length === 0) {
      return res.status(404).json({ message: 'La cancha no existe' });
    }
    if (canchaRows[0].estado !== 'disponible') {
      return res.status(400).json({ message: 'Esta cancha no está disponible actualmente' });
    }

    const [horarioRows] = await pool.execute(
      `SELECT (hora_inicio <= CURTIME() AND ? = CURDATE()) AS yaPaso
       FROM horarios WHERE id_horario = ?`,
      [fecha, id_horario]
    );
    if (horarioRows.length === 0) {
      return res.status(404).json({ message: 'El horario elegido no existe' });
    }
    if (horarioRows[0].yaPaso) {
      return res.status(400).json({ message: 'Ese horario ya pasó' });
    }

    const [ocupado] = await pool.execute(
      `SELECT t.id_turno FROM turnos t
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE t.id_cancha = ? AND t.id_horario = ? AND t.fecha = ? AND et.nombre <> 'cancelado'`,
      [id_cancha, id_horario, fecha]
    );

    if (ocupado.length > 0) {
      return res.status(409).json({ message: 'Ese horario ya está reservado, elegí otro' });
    }

    const [result] = await pool.execute(
      `INSERT INTO turnos (id_usuario, id_cancha, id_horario, id_estado, fecha)
       VALUES (?, ?, ?, (SELECT id_estado FROM estados_turno WHERE nombre = 'reservado'), ?)`,
      [req.usuario.id, id_cancha, id_horario, fecha]
    );

    res.status(201).json({ message: 'Turno reservado correctamente', id_turno: result.insertId });

  } catch (error) {
    console.error('Error al reservar turno:', error);
    res.status(500).json({ message: 'Error en el servidor' });
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
      `SELECT id_club, nombre, plan FROM club WHERE id_dueno = ?`,
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
       WHERE id_club = ?`,
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
 
    // Turnos de hoy, para listarlos en el panel
    const [turnosHoyListado] = await pool.query(
      `SELECT
          t.id_turno,
          u.nombre, u.apellido, u.usuario,
          c.nombre AS cancha,
          h.hora_inicio, h.hora_fin
       FROM turnos t
       INNER JOIN usuarios u ON t.id_usuario = u.id_usuario
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN horarios h ON t.id_horario = h.id_horario
       INNER JOIN estados_turno et ON t.id_estado = et.id_estado
       WHERE c.id_club = ? AND t.fecha = CURDATE() AND et.nombre = 'reservado'
       ORDER BY h.hora_inicio ASC
       LIMIT 5`,
      [idClub]
    );
 
    res.json({
      nombre_club: club.nombre,
      plan: club.plan,
      total_canchas: canchasRows[0].total_canchas || 0,
      canchas_activas: Number(canchasRows[0].canchas_activas) || 0,
      turnos_hoy: turnosHoyRows[0].turnos_hoy || 0,
      turnos_semana: turnosSemanaRows[0].turnos_semana || 0,
      total_clientes: clientesRows[0].total_clientes || 0,
      proximos_turnos_hoy: turnosHoyListado
    });
 
  } catch (error) {
    console.error('Error en /club/resumen:', error);
    res.status(500).json({ error: 'Error al obtener el resumen del club' });
  }
});
// ------------------ Actualizar Perfil de Usuario ------------------
app.put('/usuarios/:id', verificarToken, async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, dni, correo, telefono } = req.body;

  if (Number(req.usuario.rol) !== 1 && req.usuario.id !== Number(id)) {
    return res.status(403).json({ message: 'No autorizado' });
  }

  if (!nombre || !apellido || !correo) {
    return res.status(400).json({ message: 'Nombre, apellido y correo son obligatorios' });
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

    // Verificar que el correo o dni no estén en uso por OTRO usuario
    const [duplicados] = await conn.execute(
      'SELECT id_usuario FROM usuarios WHERE (correo = ? OR dni = ?) AND id_usuario != ?',
      [correo, dni || '', id]
    );

    if (duplicados.length > 0) {
      conn.release();
      return res.status(400).json({ message: 'El correo o DNI ya está en uso por otro usuario' });
    }

    await conn.execute(
      `UPDATE usuarios
       SET nombre = ?, apellido = ?, dni = ?, correo = ?, telefono = ?
       WHERE id_usuario = ?`,
      [nombre, apellido, dni || null, correo, telefono || null, id]
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

  if (!passwordActual || !passwordNueva) {
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
 
    // Cuentas registradas con Google/Facebook no tienen password propia
    if (!hashActual) {
      return res.status(400).json({
        message: 'Esta cuenta inició sesión con Google/Facebook y no tiene contraseña propia'
      });
    }
 
    const coincide = await bcrypt.compare(passwordActual, hashActual);
    if (!coincide) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
    }
 
    const nuevoHash = await bcrypt.hash(passwordNueva, 10);
 
    await pool.query(
      'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
      [nuevoHash, id]
    );
 
    res.json({ message: 'Contraseña actualizada correctamente' });
 
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ message: 'Error al cambiar la contraseña' });
  }
});


app.put('/turnos/:id/cancelar', verificarToken, async (req, res) => {
  const { id } = req.params;

  try {
    const [turnoRows] = await pool.query(
      `SELECT t.id_usuario, cl.id_dueno
       FROM turnos t
       INNER JOIN canchas c ON t.id_cancha = c.id_cancha
       INNER JOIN club cl ON c.id_club = cl.id_club
       WHERE t.id_turno = ?`,
      [id]
    );

    if (turnoRows.length === 0) {
      return res.status(404).json({ message: 'Turno no encontrado' });
    }

    const { id_usuario: idUsuarioTurno, id_dueno: idDuenoClub } = turnoRows[0];
    const esDueno = Number(req.usuario.rol) === 1
      || req.usuario.id === idUsuarioTurno
      || req.usuario.id === idDuenoClub;

    if (!esDueno) {
      return res.status(403).json({ message: 'No autorizado' });
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
 
    res.json({ message: 'Turno cancelado correctamente' });
 
  } catch (error) {
    console.error('Error al cancelar turno:', error);
    res.status(500).json({ message: 'Error al cancelar el turno' });
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
    const conn = await pool.getConnection();
 
    const [rows] = await conn.execute(
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
       WHERE t.id_usuario = ?
       ORDER BY t.fecha ASC, h.hora_inicio ASC`,
      [id_usuario]
    );
 
    conn.release();
    res.json(rows);
 
  } catch (error) {
    console.error('Error en /turnos:', error);
    res.status(500).json({ message: 'Error al obtener turnos' });
  }
});
// ------------------ SERVER ------------------
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});