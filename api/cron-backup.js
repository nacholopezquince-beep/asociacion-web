// Función serverless de Vercel. Se ejecuta sola una vez al día (ver vercel.json),
// llamada automáticamente por Vercel Cron. Exporta todas las tablas y las guarda
// como un archivo JSON en el almacén "backups" de Supabase.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

module.exports = async (req, res) => {
  // Comprueba que quien llama es el propio Vercel Cron, no cualquiera de internet.
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'No autorizado.' });
    return;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.' });
    return;
  }

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [socios, cuotas, incidencias, gastos, actas, convocatorias, ajustes] = await Promise.all([
      admin.from('socios').select('*'),
      admin.from('cuotas').select('*'),
      admin.from('incidencias').select('*'),
      admin.from('gastos').select('*'),
      admin.from('actas').select('*'),
      admin.from('convocatorias').select('*'),
      admin.from('ajustes').select('*')
    ]);

    const backup = {
      exportado_el: new Date().toISOString(),
      socios: socios.data || [],
      cuotas: cuotas.data || [],
      incidencias: incidencias.data || [],
      gastos: gastos.data || [],
      actas: actas.data || [],
      convocatorias: convocatorias.data || [],
      ajustes: ajustes.data || []
    };

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `backup-${fecha}.json`;

    const { error: uploadError } = await admin.storage
      .from('backups')
      .upload(nombreArchivo, JSON.stringify(backup, null, 2), {
        contentType: 'application/json',
        upsert: true
      });
    if (uploadError) throw uploadError;

    res.status(200).json({ ok: true, archivo: nombreArchivo });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error desconocido.' });
  }
};
