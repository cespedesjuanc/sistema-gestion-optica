// =====================================================================
//  reportes.js — Consultas a la base de datos
//  Todas las lecturas y escrituras a Supabase pasan por el objeto BD.
//  logica.js nunca habla directo con Supabase: siempre llama a BD.
// =====================================================================

const BD = (() => {
  const sb = supabaseClient;

  // ---------- utilidades internas ----------------------------------

  // Convierte errores de Supabase/Postgres en mensajes entendibles
  function traducirError(error) {
    const msg = error?.message || String(error);
    const code = error?.code;
    if (code === '23505') return new Error('Ya existe un registro con ese dato (DNI, código o email repetido).');
    if (code === '23503') return new Error('No se puede eliminar: tiene registros asociados (turnos, consultas, etc.).');
    if (code === 'PGRST116') return new Error('No tenés permisos sobre ese registro o ya no existe.');
    if (code === '42501' || /row-level security|permission denied/i.test(msg))
      return new Error('No tenés permisos para realizar esta acción.');
    if (/Invalid login credentials/i.test(msg)) return new Error('Email o contraseña incorrectos.');
    if (/Failed to fetch|NetworkError/i.test(msg)) return new Error('No hay conexión con el servidor. Revisá tu internet.');
    return new Error(msg);
  }

  // Ejecuta una consulta y devuelve los datos (o lanza un Error legible)
  async function q(consulta) {
    const { data, error } = await consulta;
    if (error) throw traducirError(error);
    return data;
  }

  // Trae todas las filas aunque superen el límite de 1000 de Supabase
  async function traerTodo(armarConsulta, tamPagina = 1000) {
    let desde = 0, todas = [];
    while (true) {
      const filas = await q(armarConsulta().range(desde, desde + tamPagina - 1));
      todas = todas.concat(filas);
      if (filas.length < tamPagina) return todas;
      desde += tamPagina;
    }
  }

  // Quita caracteres que rompen los filtros "or" de PostgREST
  const limpiarBusqueda = (t) => (t || '').replace(/[,()*%\\]/g, ' ').trim();

  // Quita acentos y pasa a minúsculas (misma regla que la columna "busqueda" de la base)
  const sinAcentos = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const fechaISO = (d) => {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
  };

  // ================================================================
  //  SESIÓN Y PERFIL
  // ================================================================
  async function login(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw traducirError(error);
    return data;
  }
  // Cierra la sesión solo en este navegador (no afecta otras computadoras)
  async function logout() {
    try { await sb.auth.signOut({ scope: 'local' }); } catch { /* sin conexión: igual se borra localmente */ }
  }
  async function sesionActual() {
    const { data } = await sb.auth.getSession();
    return data.session;
  }
  async function cambiarMiPassword(password) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw traducirError(error);
  }
  async function perfilActual() {
    const sesion = await sesionActual();
    if (!sesion) return null;
    return q(sb.from('perfiles')
      .select('*, profesionales(id, nombre, apellido, especialidad, consultorio, consultorio_hoy, consultorio_fecha)')
      .eq('id', sesion.user.id).maybeSingle());
  }

  // ================================================================
  //  CONFIGURACIÓN DE LA ÓPTICA
  // ================================================================
  async function obtenerConfiguracion() {
    try { return await q(sb.from('configuracion').select('*').eq('id', 1).maybeSingle()); }
    catch { return null; }
  }
  const guardarConfiguracion = (datos) =>
    q(sb.from('configuracion').update({ ...datos, updated_at: new Date().toISOString() }).eq('id', 1).select().single());

  // ================================================================
  //  USUARIOS
  // ================================================================
  const listarUsuarios = () =>
    q(sb.from('perfiles').select('*, profesionales(nombre, apellido)').order('apellido'));

  const crearUsuario = ({ email, password, nombre, apellido, rol, profesional_id }) =>
    q(sb.rpc('crear_usuario', {
      p_email: email, p_password: password, p_nombre: nombre, p_apellido: apellido,
      p_rol: rol, p_profesional_id: profesional_id || null,
    }));

  const actualizarUsuario = (id, campos) =>
    q(sb.from('perfiles').update(campos).eq('id', id).select().single());

  const cambiarPasswordUsuario = (id, password) =>
    q(sb.rpc('admin_cambiar_password', { p_usuario: id, p_password: password }));

  // ================================================================
  //  PROFESIONALES
  // ================================================================
  async function listarProfesionales({ soloActivos = false } = {}) {
    let c = sb.from('profesionales').select('*, horarios_profesional(*)').order('apellido');
    if (soloActivos) c = c.eq('activo', true);
    return q(c);
  }

  async function guardarProfesional(prof, horarios) {
    const { id, horarios_profesional, created_at, ...campos } = prof;
    const guardado = id
      ? await q(sb.from('profesionales').update(campos).eq('id', id).select().single())
      : await q(sb.from('profesionales').insert(campos).select().single());

    // los horarios se reemplazan completos
    await q(sb.from('horarios_profesional').delete().eq('profesional_id', guardado.id));
    if (horarios.length) {
      await q(sb.from('horarios_profesional')
        .insert(horarios.map((h) => ({ ...h, profesional_id: guardado.id }))));
    }
    return guardado;
  }

  // ================================================================
  //  PRÁCTICAS Y TARIFAS
  // ================================================================
  const listarPracticas = ({ soloActivas = false } = {}) => {
    let c = sb.from('practicas').select('*').order('nombre');
    if (soloActivas) c = c.eq('activo', true);
    return q(c);
  };

  const guardarPractica = ({ id, created_at, ...campos }) => id
    ? q(sb.from('practicas').update(campos).eq('id', id).select().single())
    : q(sb.from('practicas').insert(campos).select().single());

  const listarTarifas = () =>
    q(sb.from('tarifas')
      .select('*, practicas(codigo, nombre), profesionales(nombre, apellido)')
      .order('vigente_desde', { ascending: false }));

  const agregarTarifa = (t) => q(sb.from('tarifas').insert(t).select().single());
  const eliminarTarifa = (id) => q(sb.from('tarifas').delete().eq('id', id));

  // Precio vigente calculado en el navegador a partir de la lista de tarifas
  // (misma regla que la función precio_vigente de la base).
  function precioVigente(tarifas, practicaId, profesionalId, fecha = fechaISO(new Date())) {
    const candidatas = tarifas
      .filter((t) => t.practica_id === practicaId && t.vigente_desde <= fecha &&
        (t.profesional_id === null || t.profesional_id === profesionalId))
      .sort((a, b) => {
        const pa = a.profesional_id === null ? 1 : 0, pb = b.profesional_id === null ? 1 : 0;
        return pa - pb || b.vigente_desde.localeCompare(a.vigente_desde);
      });
    return candidatas.length ? Number(candidatas[0].precio) : null;
  }

  // ================================================================
  //  PACIENTES
  // ================================================================
  async function buscarPacientes(texto = '', { pagina = 0, porPagina = 25, incluirBajas = false } = {}) {
    let c = sb.from('pacientes').select('*', { count: 'exact' })
      .order('apellido').order('nombre')
      .range(pagina * porPagina, pagina * porPagina + porPagina - 1);
    // Se busca sin acentos ni mayúsculas: "nunez" encuentra "Núñez".
    // Cada palabra escrita debe aparecer en el apellido, el nombre o el DNI.
    const palabras = sinAcentos(limpiarBusqueda(texto)).split(/\s+/).filter(Boolean);
    palabras.forEach((p) => { c = c.ilike('busqueda', `%${p}%`); });
    if (!incluirBajas) c = c.eq('activo', true);
    const { data, error, count } = await c;
    if (error) throw traducirError(error);
    return { filas: data, total: count };
  }

  const obtenerPaciente = (id) => q(sb.from('pacientes').select('*').eq('id', id).single());

  const guardarPaciente = ({ id, created_at, telefono_normalizado, busqueda, activo, fecha_baja, motivo_baja,
    consentimiento_datos, consentimiento_fecha, consentimiento_registrado_por, ...campos }) => {
    for (const k in campos) if (campos[k] === '') campos[k] = null;
    return id
      ? q(sb.from('pacientes').update(campos).eq('id', id).select().single())
      : q(sb.from('pacientes').insert(campos).select().single());
  };

  const eliminarPaciente = (id) => q(sb.from('pacientes').delete().eq('id', id));

  // Baja lógica (la historia clínica se conserva) y reactivación — solo administradores
  const darDeBajaPaciente = (id, motivo) => q(sb.rpc('baja_paciente', { p_paciente: id, p_motivo: motivo }));
  const reactivarPaciente = (id) => q(sb.rpc('reactivar_paciente', { p_paciente: id }));

  // Consentimiento firmado por el paciente (fecha y usuario los registra el servidor)
  const registrarConsentimiento = (id, otorgado) =>
    q(sb.rpc('registrar_consentimiento', { p_paciente: id, p_otorgado: otorgado }));

  // Compromiso de confidencialidad del usuario logueado
  const aceptarConfidencialidad = () => q(sb.rpc('aceptar_confidencialidad'));

  // ================================================================
  //  HISTORIA CLÍNICA
  // ================================================================
  const listarConsultas = (pacienteId) =>
    q(sb.from('consultas')
      .select('*, recetas(*), enmiendas_hc(*), profesionales(nombre, apellido, especialidad, matricula)')
      .eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false }));

  // Enmienda: corrección posterior de una consulta (no reemplaza lo original)
  const agregarEnmienda = (consultaId, texto, profesionalId = null) =>
    q(sb.from('enmiendas_hc').insert({ consulta_id: consultaId, texto, profesional_id: profesionalId }).select().single());

  async function guardarConsulta(consulta, receta) {
    const { id, recetas, profesionales, enmiendas_hc, created_at, creado_por, ...campos } = consulta;
    for (const k in campos) if (campos[k] === '') campos[k] = null;
    const guardada = id
      ? await q(sb.from('consultas').update(campos).eq('id', id).select().single())
      : await q(sb.from('consultas').insert(campos).select().single());

    if (receta) {
      const { id: recetaId, created_at: _c, ...r } = receta;
      for (const k in r) if (r[k] === '') r[k] = null;
      r.consulta_id = guardada.id;
      r.paciente_id = guardada.paciente_id;
      if (recetaId) await q(sb.from('recetas').update(r).eq('id', recetaId));
      else await q(sb.from('recetas').insert(r));
    }
    return guardada;
  }

  // ================================================================
  //  TURNOS
  // ================================================================
  function listarTurnos({ desde, hasta, profesionalId, estado, pacienteId } = {}) {
    return traerTodo(() => {
      let c = sb.from('v_turnos_detalle').select('*');
      if (desde) c = c.gte('fecha', desde);
      if (hasta) c = c.lte('fecha', hasta);
      if (profesionalId) c = c.eq('profesional_id', profesionalId);
      if (pacienteId) c = c.eq('paciente_id', pacienteId);
      if (estado) c = c.eq('estado', estado);
      return c.order('fecha').order('hora').order('id');
    });
  }

  const turnosDePaciente = (pacienteId) =>
    q(sb.from('v_turnos_detalle').select('*').eq('paciente_id', pacienteId)
      .order('fecha', { ascending: false }).order('hora', { ascending: false }));

  async function turnosDisponibles(profesionalId, fecha) {
    const filas = await q(sb.rpc('turnos_disponibles', { p_profesional: profesionalId, p_fecha: fecha }));
    return filas.map((f) => f.hora.slice(0, 5));
  }

  const guardarTurno = ({ id, ...campos }) => id
    ? q(sb.from('turnos').update(campos).eq('id', id).select().single())
    : q(sb.from('turnos').insert(campos).select().single());

  const cambiarEstadoTurno = (id, estado) =>
    q(sb.from('turnos').update({ estado }).eq('id', id).select().single());

  const eliminarTurno = (id) => q(sb.from('turnos').delete().eq('id', id));

  // ================================================================
  //  SALA DE ESPERA Y LLAMADOR
  // ================================================================
  // Recepción registra que el paciente llegó
  const marcarLlegada = (id) =>
    q(sb.from('turnos').update({ estado: 'en_espera', llegada_at: new Date().toISOString() }).eq('id', id).select().single());

  // Llama al paciente (lo muestra y anuncia la pantalla del llamador)
  const llamarPaciente = (turnoId) => q(sb.rpc('llamar_paciente', { p_turno: turnoId }));

  // El médico define en qué consultorio atiende hoy
  const definirConsultorio = (consultorio) => q(sb.rpc('definir_consultorio', { p_consultorio: consultorio }));

  // Llamados de hoy (los más recientes primero); con desdeId trae solo los nuevos
  function llamadosDeHoy({ desdeId = 0, limite = 8 } = {}) {
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    let c = sb.from('llamados').select('*').gte('created_at', inicio.toISOString())
      .order('id', { ascending: false }).limit(limite);
    if (desdeId) c = c.gt('id', desdeId);
    return q(c);
  }

  // Suscripción en tiempo real a nuevos llamados (Supabase Realtime)
  function escucharLlamados(alLlegar) {
    return sb.channel('llamados-sala')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'llamados' }, (p) => alLlegar(p.new))
      .subscribe();
  }

  // ================================================================
  //  AUDITORÍA
  // ================================================================
  // Registra que el usuario vio, imprimió o exportó información (no bloquea la pantalla)
  function registrarAcceso(accion, tabla, pacienteId = null, detalle = null) {
    sb.rpc('registrar_acceso', { p_accion: accion, p_tabla: tabla, p_paciente: pacienteId, p_detalle: detalle })
      .then(({ error }) => { if (error) console.warn('Auditoría:', error.message); });
  }

  // Registros de auditoría con filtros (solo administradores)
  async function listarAuditoria({ desde, hasta, accion, tabla, usuarioId, pacienteId, pagina = 0, porPagina = 50 } = {}) {
    let c = sb.from('auditoria').select('*', { count: 'exact' })
      .order('id', { ascending: false })
      .range(pagina * porPagina, pagina * porPagina + porPagina - 1);
    if (desde) c = c.gte('created_at', new Date(desde + 'T00:00').toISOString());
    if (hasta) c = c.lte('created_at', new Date(hasta + 'T23:59:59').toISOString());
    if (accion) c = c.eq('accion', accion);
    if (tabla) c = c.eq('tabla', tabla);
    if (usuarioId) c = c.eq('usuario_id', usuarioId);
    if (pacienteId) c = c.eq('paciente_id', pacienteId);
    const { data, error, count } = await c;
    if (error) throw traducirError(error);
    return { filas: data, total: count };
  }

  // ================================================================
  //  REPORTES Y TABLERO
  // ================================================================

  async function contar(tabla, filtros = (c) => c) {
    const { count, error } = await filtros(sb.from(tabla).select('id', { count: 'exact', head: true }));
    if (error) throw traducirError(error);
    return count || 0;
  }

  // Datos del panel de inicio
  async function resumenInicio({ profesionalId } = {}) {
    const hoy = new Date();
    const hoyISO = fechaISO(hoy);
    const inicioMes = fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    const finMes = fechaISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
    const en7 = fechaISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 7));

    const [turnosMes, proximos, totalPacientes, profesionalesActivos, pacientesNuevosMes] = await Promise.all([
      listarTurnos({ desde: inicioMes, hasta: finMes, profesionalId }),
      listarTurnos({ desde: hoyISO, hasta: en7, profesionalId }),
      contar('pacientes'),
      contar('profesionales', (c) => c.eq('activo', true)),
      contar('pacientes', (c) => c.gte('created_at', inicioMes)),
    ]);

    const turnosHoy = proximos.filter((t) => t.fecha === hoyISO);
    const porEstadoHoy = contarPor(turnosHoy, 'estado');
    const horaAhora = hoy.toTimeString().slice(0, 5);

    const atendidosMes = turnosMes.filter((t) => t.estado === 'atendido');
    const ausentesMes = turnosMes.filter((t) => t.estado === 'ausente').length;

    return {
      hoy: {
        total: turnosHoy.length,
        pendiente: porEstadoHoy.pendiente || 0,
        confirmado: porEstadoHoy.confirmado || 0,
        en_espera: porEstadoHoy.en_espera || 0,
        atendido: porEstadoHoy.atendido || 0,
        cancelado: porEstadoHoy.cancelado || 0,
        ausente: porEstadoHoy.ausente || 0,
      },
      proximos: proximos
        .filter((t) => ['pendiente', 'confirmado', 'en_espera'].includes(t.estado))
        .filter((t) => t.fecha > hoyISO || t.hora.slice(0, 5) >= horaAhora)
        .slice(0, 8),
      semana: proximos.filter((t) => t.estado !== 'cancelado').length,
      totalPacientes,
      profesionalesActivos,
      pacientesNuevosMes,
      mes: {
        total: turnosMes.length,
        atendidos: atendidosMes.length,
        ausentes: ausentesMes,
        facturacion: sumar(atendidosMes, 'precio'),
        asistencia: atendidosMes.length + ausentesMes
          ? Math.round((atendidosMes.length / (atendidosMes.length + ausentesMes)) * 100) : 0,
        whatsapp: turnosMes.filter((t) => t.origen === 'whatsapp').length,
        topPracticas: ordenarTop(agruparTurnos(atendidosMes, 'practica_id', (t) => t.practica), 5),
      },
    };
  }

  // Reporte general para un período y (opcionalmente) un profesional
  async function reporteGeneral({ desde, hasta, profesionalId }) {
    const [turnos, pacientesNuevos] = await Promise.all([
      listarTurnos({ desde, hasta, profesionalId }),
      contar('pacientes', (c) => c.gte('created_at', desde).lte('created_at', hasta + 'T23:59:59')),
    ]);

    const atendidos = turnos.filter((t) => t.estado === 'atendido');
    const porEstado = contarPor(turnos, 'estado');
    const ausentes = porEstado.ausente || 0;
    const facturacion = sumar(atendidos, 'precio');

    // por día (incluye días sin turnos para que el gráfico sea continuo)
    const porDia = [];
    for (let d = new Date(desde + 'T00:00'); fechaISO(d) <= hasta; d.setDate(d.getDate() + 1)) {
      const f = fechaISO(d);
      const delDia = turnos.filter((t) => t.fecha === f);
      porDia.push({
        fecha: f,
        total: delDia.filter((t) => t.estado !== 'cancelado').length,
        atendidos: delDia.filter((t) => t.estado === 'atendido').length,
        facturacion: sumar(delDia.filter((t) => t.estado === 'atendido'), 'precio'),
      });
    }

    // por profesional
    const mapaProf = {};
    turnos.forEach((t) => {
      const p = (mapaProf[t.profesional_id] ||= {
        id: t.profesional_id, nombre: t.profesional, color: t.profesional_color,
        total: 0, atendidos: 0, ausentes: 0, cancelados: 0, pendientes: 0, facturacion: 0,
      });
      p.total++;
      if (t.estado === 'atendido') { p.atendidos++; p.facturacion += Number(t.precio || 0); }
      else if (t.estado === 'ausente') p.ausentes++;
      else if (t.estado === 'cancelado') p.cancelados++;
      else p.pendientes++;
    });
    const porProfesional = Object.values(mapaProf).map((p) => ({
      ...p,
      ausentismo: p.atendidos + p.ausentes ? (p.ausentes / (p.atendidos + p.ausentes)) * 100 : 0,
    })).sort((a, b) => b.facturacion - a.facturacion);

    return {
      turnos,
      kpi: {
        total: turnos.length,
        atendidos: atendidos.length,
        ausentes,
        cancelados: porEstado.cancelado || 0,
        pendientes: (porEstado.pendiente || 0) + (porEstado.confirmado || 0) + (porEstado.en_espera || 0),
        facturacion,
        ticketPromedio: atendidos.length ? facturacion / atendidos.length : 0,
        ausentismo: atendidos.length + ausentes ? (ausentes / (atendidos.length + ausentes)) * 100 : 0,
        pacientesAtendidos: new Set(atendidos.map((t) => t.paciente_id)).size,
        pacientesNuevos,
        whatsapp: turnos.filter((t) => t.origen === 'whatsapp').length,
      },
      porEstado,
      porDia,
      porProfesional,
      porPractica: ordenarTop(agruparTurnos(atendidos, 'practica_id', (t) => t.practica)),
      porObraSocial: ordenarTop(agruparTurnos(atendidos, 'paciente_obra_social', (t) => t.paciente_obra_social || 'Sin datos')),
    };
  }

  // ---------- helpers de agregación --------------------------------
  function contarPor(lista, campo) {
    return lista.reduce((acc, x) => { acc[x[campo]] = (acc[x[campo]] || 0) + 1; return acc; }, {});
  }
  function sumar(lista, campo) {
    return lista.reduce((s, x) => s + Number(x[campo] || 0), 0);
  }
  function agruparTurnos(lista, clave, etiqueta) {
    const m = {};
    lista.forEach((t) => {
      const g = (m[t[clave]] ||= { nombre: etiqueta(t), cantidad: 0, facturacion: 0 });
      g.cantidad++;
      g.facturacion += Number(t.precio || 0);
    });
    return Object.values(m);
  }
  function ordenarTop(lista, n) {
    const ord = lista.sort((a, b) => b.cantidad - a.cantidad);
    return n ? ord.slice(0, n) : ord;
  }

  // ---------- API pública -------------------------------------------
  return {
    fechaISO,
    login, logout, sesionActual, cambiarMiPassword, perfilActual,
    obtenerConfiguracion, guardarConfiguracion,
    listarUsuarios, crearUsuario, actualizarUsuario, cambiarPasswordUsuario,
    listarProfesionales, guardarProfesional,
    listarPracticas, guardarPractica, listarTarifas, agregarTarifa, eliminarTarifa, precioVigente,
    buscarPacientes, obtenerPaciente, guardarPaciente, eliminarPaciente,
    darDeBajaPaciente, reactivarPaciente, registrarConsentimiento, aceptarConfidencialidad,
    listarConsultas, guardarConsulta, agregarEnmienda,
    listarTurnos, turnosDePaciente, turnosDisponibles, guardarTurno, cambiarEstadoTurno, eliminarTurno,
    marcarLlegada, llamarPaciente, definirConsultorio, llamadosDeHoy, escucharLlamados,
    resumenInicio, reporteGeneral,
    registrarAcceso, listarAuditoria,
  };
})();
