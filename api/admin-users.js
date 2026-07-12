// Función serverless de Vercel. Vive en el servidor, nunca en el navegador.
// Usa la clave secreta de Supabase (guardada como variable de entorno en Vercel,
// nunca en este archivo ni en el código del navegador) para crear, listar y
// eliminar usuarios con permiso de administrador.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'No autenticado.' }); return; }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: callerData, error: callerError } = await adminClient.auth.getUser(token);
  if (callerError || !callerData?.user) {
    res.status(401).json({ error: 'Sesión no válida.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const usuarios = data.users.map(u => ({
        id: u.id,
        email: u.email,
        creado: u.created_at,
        ultimo_acceso: u.last_sign_in_at
      }));
      res.status(200).json({ usuarios });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { email, password } = body || {};
      if (!email || !password) { res.status(400).json({ error: 'Falta email o contraseña.' }); return; }
      if (password.length < 6) { res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' }); return; }
      const { data, error } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true
      });
      if (error) throw error;
      res.status(200).json({ ok: true, id: data.user.id });
      return;
    }

    if (req.method === 'DELETE') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { id } = body || {};
      if (!id) { res.status(400).json({ error: 'Falta el id del usuario.' }); return; }
      if (id === callerData.user.id) { res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde aquí.' }); return; }
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Método no permitido.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error desconocido.' });
  }
};
