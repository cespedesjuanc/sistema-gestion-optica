// =====================================================================
//  logica.js — Lógica de la interfaz del Sistema de Gestión Óptica
//  Navegación, permisos por rol, pantallas, formularios y gráficos.
//  Los datos se obtienen siempre a través del objeto BD (reportes.js).
// =====================================================================
'use strict';

// ---------------------------------------------------------------------
// 1. ESTADO GLOBAL Y CONSTANTES
// ---------------------------------------------------------------------
const APP = {
  perfil: null,          // usuario logueado (tabla perfiles)
  config: null,          // datos de la óptica
  profesionales: [],     // catálogos en memoria
  practicas: [],
  tarifas: [],
  graficos: {},          // instancias de Chart.js
  turnos: { fecha: null, profesionalId: '', estado: '' },
  pacientes: { texto: '', pagina: 0, porPagina: 25, incluirBajas: false },
  ficha: { paciente: null, pestana: null },
  turnosVisibles: new Map(),
};

const ROLES = { admin: 'Administrador', medico: 'Médico', recepcion: 'Recepción' };

const ESTADOS = {
  pendiente:  { texto: 'Pendiente',  color: 'var(--ambar)' },
  confirmado: { texto: 'Confirmado', color: 'var(--azul)' },
  en_espera:  { texto: 'En espera',  color: 'var(--violeta)' },
  atendido:   { texto: 'Atendido',   color: 'var(--verde)' },
  ausente:    { texto: 'Ausente',    color: 'var(--rojo)' },
  cancelado:  { texto: 'Cancelado',  color: '#98A4AE' },
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const HORAS_EDICION_HC = 24;   // igual que horas_edicion_hc() en la base
const TIPOS_RECETA = { lejos: 'Lejos', cerca: 'Cerca', intermedia: 'Intermedia', multifocal: 'Multifocal', contacto: 'Lentes de contacto' };
const OBRAS_SOCIALES = ['Particular', 'OSDE', 'Swiss Medical', 'Galeno', 'Medifé', 'IOMA', 'PAMI', 'OSECAC', 'Omint', 'Sancor Salud'];

// Colores de la paleta para los gráficos (leídos del CSS)
const COLOR = {};

// Menú lateral: qué ve cada rol
const MENU = [
  { vista: 'inicio',        texto: 'Inicio',              icono: 'inicio',       roles: ['admin', 'medico', 'recepcion'] },
  { grupo: 'Atención',                                                            roles: ['admin', 'medico', 'recepcion'] },
  { vista: 'turnos',        texto: 'Turnos',              icono: 'calendario',   roles: ['admin', 'medico', 'recepcion'] },
  { vista: 'pacientes',     texto: 'Pacientes',           icono: 'usuarios',     roles: ['admin', 'medico', 'recepcion'] },
  { grupo: 'Gestión',                                                             roles: ['admin', 'recepcion'] },
  { vista: 'profesionales', texto: 'Profesionales',       icono: 'estetoscopio', roles: ['admin', 'recepcion'] },
  { vista: 'practicas',     texto: 'Prácticas y tarifas', icono: 'etiqueta',     roles: ['admin', 'recepcion'] },
  { vista: 'reportes',      texto: 'Reportes',            icono: 'grafico',      roles: ['admin'] },
  { grupo: 'Sistema',                                                             roles: ['admin'] },
  { vista: 'usuarios',      texto: 'Usuarios',            icono: 'escudo',       roles: ['admin'] },
  { vista: 'auditoria',     texto: 'Auditoría',           icono: 'ver',          roles: ['admin'] },
  { vista: 'configuracion', texto: 'Configuración',       icono: 'ajustes',      roles: ['admin'] },
];

// Pantallas: título y función que las carga
const VISTAS = {
  inicio:        { titulo: 'Inicio',              cargar: cargarInicio },
  turnos:        { titulo: 'Turnos',              cargar: cargarTurnos },
  pacientes:     { titulo: 'Pacientes',           cargar: cargarPacientes },
  paciente:      { titulo: 'Ficha del paciente',  cargar: cargarFicha, menu: 'pacientes', roles: ['admin', 'medico', 'recepcion'] },
  profesionales: { titulo: 'Profesionales',       cargar: cargarProfesionales },
  practicas:     { titulo: 'Prácticas y tarifas', cargar: cargarPracticas },
  reportes:      { titulo: 'Reportes',            cargar: cargarReportes },
  usuarios:      { titulo: 'Usuarios',            cargar: cargarUsuarios },
  auditoria:     { titulo: 'Auditoría',           cargar: cargarAuditoria },
  configuracion: { titulo: 'Configuración',       cargar: cargarConfiguracion },
};

// ---------------------------------------------------------------------
// 2. ÍCONOS (SVG de línea)
// ---------------------------------------------------------------------
const ICONOS = {
  inicio: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  usuarios: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  usuario: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  estetoscopio: '<path d="M5 3H4v6a5 5 0 0 0 10 0V3h-1"/><path d="M9 14v1a6 6 0 0 0 12 0v-3"/><circle cx="21" cy="10" r="2"/>',
  etiqueta: '<path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5"/>',
  grafico: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  ajustes: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  borrar: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  ver: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  checkCirculo: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
  cerrar: '<path d="M18 6 6 18M6 6l12 12"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  telefono: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  llave: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  imprimir: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  descargar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>',
  atender: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  ausente: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="m18 8 5 5M23 8l-5 5"/>',
  deshacer: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  vacio: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  dinero: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  historia: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  llamar: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  mudo: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m23 9-6 6M17 9l6 6"/>',
  pantalla: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  llego: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  expandir: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  puerta: '<path d="M3 21h18M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><circle cx="14.5" cy="12" r=".8"/>',
  anteojos: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M10 15h4M2 15l1.5-7.5A2 2 0 0 1 5.5 6H6M22 15l-1.5-7.5A2 2 0 0 0 18.5 6H18"/>',
};
const icono = (nombre, clase = '') =>
  `<svg class="icono ${clase}" viewBox="0 0 24 24" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;

// ---------------------------------------------------------------------
// 3. UTILIDADES
// ---------------------------------------------------------------------
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// Escapa texto para insertarlo en HTML de forma segura
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const hoy = () => BD.fechaISO(new Date());
const sumarDias = (iso, n) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + n); return BD.fechaISO(d); };
const fmtFecha = (iso) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
const fmtHora = (h) => (h || '').slice(0, 5);
const fmtFechaLarga = (iso) => new Date(iso + 'T00:00')
  .toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtFechaHora = (ts) => new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const formatoDinero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const dinero = (n) => (n === null || n === undefined || n === '') ? '—' : formatoDinero.format(n);
const numero = (n, dec = 0) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: dec });
const nombreProf = (p) => p ? `${p.apellido}, ${p.nombre}` : '';
const iniciales = (nombre, apellido) => ((nombre || '?')[0] + (apellido || '')[0]).toUpperCase();

function edad(fechaNac) {
  if (!fechaNac) return null;
  const n = new Date(fechaNac + 'T00:00'), h = new Date();
  let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--;
  return e;
}

// Graduación con signo: +1,25 / -0,50
function grad(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return (n > 0 ? '+' : '') + n.toFixed(2).replace('.', ',');
}

function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

const badgeEstado = (e) => `<span class="badge badge-${e}">${esc(ESTADOS[e]?.texto || e)}</span>`;
const badgeRol = (r) => `<span class="badge badge-${r}">${esc(ROLES[r] || r)}</span>`;
const vacio = (texto) => `<div class="vacio">${icono('vacio')}<div>${esc(texto)}</div></div>`;
const cargando = () => '<div class="cargando">Cargando…</div>';

// Permisos
const rol = () => APP.perfil?.rol;
const esAdmin = () => rol() === 'admin';
const puedeVerHC = () => ['admin', 'medico'].includes(rol());
const puedeEditarConsulta = (c) => esAdmin() || (rol() === 'medico' && c.profesional_id === APP.perfil.profesional_id);
const puedeAtender = (t) => esAdmin() || (rol() === 'medico' && t.profesional_id === APP.perfil.profesional_id);

// Avisos (toasts)
function aviso(texto, tipo = 'ok') {
  const el = document.createElement('div');
  el.className = `aviso ${tipo === 'error' ? 'error' : tipo === 'info' ? 'info' : ''}`;
  el.textContent = texto;
  $('#avisos').appendChild(el);
  setTimeout(() => el.remove(), tipo === 'error' ? 6000 : 3500);
}
const avisoError = (e) => { console.error(e); aviso(e.message || String(e), 'error'); };

// Lee los campos de un formulario como objeto (los checkbox como true/false)
function datosForm(form) {
  const datos = {};
  $$('input, select, textarea', form).forEach((el) => {
    if (!el.name) return;
    datos[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return datos;
}

function opciones(lista, valor, { vacioTexto = null } = {}) {
  return (vacioTexto !== null ? `<option value="">${esc(vacioTexto)}</option>` : '') +
    lista.map((o) => `<option value="${esc(o.valor)}" ${String(o.valor) === String(valor ?? '') ? 'selected' : ''}>${esc(o.texto)}</option>`).join('');
}
const opcionesProfesionales = (valor, vacioTexto, soloActivos = true) => opciones(
  APP.profesionales.filter((p) => !soloActivos || p.activo || p.id === Number(valor))
    .map((p) => ({ valor: p.id, texto: `${nombreProf(p)} — ${p.especialidad}` })), valor, { vacioTexto });
const opcionesPracticas = (valor, vacioTexto) => opciones(
  APP.practicas.filter((p) => p.activo || p.id === Number(valor))
    .map((p) => ({ valor: p.id, texto: `${p.nombre} (${p.codigo})` })), valor, { vacioTexto });

// Exporta una tabla (lista de filas) a CSV compatible con Excel en español
function exportarCSV(nombreArchivo, encabezados, filas) {
  BD.registrarAcceso('exportar', nombreArchivo.startsWith('auditoria') ? 'auditoria' : 'reportes', null, { archivo: nombreArchivo, filas: filas.length });
  const celda = (v) => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [encabezados, ...filas].map((f) => f.map(celda).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------------
// 4. VENTANAS MODALES
// ---------------------------------------------------------------------
/**
 * Abre una ventana modal con un formulario.
 *  titulo, cuerpo (HTML), tam ('chico' | 'ancho'), textoGuardar,
 *  onGuardar(datos, form) → si lanza un error, la ventana queda abierta.
 *  alAbrir(form) → para enlazar eventos propios del formulario.
 */
function abrirModal({ titulo, cuerpo, tam = '', textoGuardar = 'Guardar', claseGuardar = '', onGuardar, alAbrir, soloLectura = false,
  bloqueante = false, textoCancelar = null, onCancelar = null }) {
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.innerHTML = `
    <form class="modal ${tam}" novalidate>
      <div class="modal-cab"><h3>${esc(titulo)}</h3>
        ${bloqueante ? '' : `<button type="button" class="btn btn-icono" data-cerrar title="Cerrar">${icono('cerrar')}</button>`}</div>
      <div class="modal-cuerpo">${cuerpo}</div>
      <div class="modal-pie">
        <button type="button" class="btn btn-sec" data-cerrar>${textoCancelar || (soloLectura ? 'Cerrar' : 'Cancelar')}</button>
        ${soloLectura ? '' : `<button type="submit" class="btn ${claseGuardar}">${esc(textoGuardar)}</button>`}
      </div>
    </form>`;
  const form = $('form', fondo);
  const cerrar = () => { fondo.remove(); document.removeEventListener('keydown', alTeclear); };
  const alTeclear = (e) => { if (!bloqueante && e.key === 'Escape' && fondo === $('#modales').lastElementChild) cerrar(); };

  $$('[data-cerrar]', fondo).forEach((b) => b.addEventListener('click', () => { cerrar(); if (onCancelar) onCancelar(); }));
  fondo.addEventListener('mousedown', (e) => { if (!bloqueante && e.target === fondo) cerrar(); });
  document.addEventListener('keydown', alTeclear);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!onGuardar) return cerrar();
    // validación nativa del navegador
    const invalido = $$('input, select, textarea', form).find((el) => !el.disabled && !el.checkValidity());
    if (invalido) { invalido.reportValidity(); return; }
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      const r = await onGuardar(datosForm(form), form);
      if (r !== false) cerrar();
    } catch (err) {
      avisoError(err);
    } finally {
      btn.disabled = false;
    }
  });

  $('#modales').appendChild(fondo);
  if (alAbrir) alAbrir(form, cerrar);
  const primero = $('input:not([type=hidden]):not([disabled]), select, textarea', form);
  if (primero) setTimeout(() => primero.focus(), 50);
  return { form, cerrar };
}

// Confirmación (reemplaza a window.confirm)
function confirmar(mensaje, { titulo = 'Confirmar', textoOk = 'Aceptar', peligro = false } = {}) {
  return new Promise((resolver) => {
    let ok = false;
    const m = abrirModal({
      titulo, tam: 'chico', textoGuardar: textoOk, claseGuardar: peligro ? 'btn-peligro' : '',
      cuerpo: `<p style="margin:0;line-height:1.5">${mensaje}</p>`,
      onGuardar: () => { ok = true; },
    });
    new MutationObserver((_, obs) => {
      if (!document.body.contains(m.form)) { obs.disconnect(); resolver(ok); }
    }).observe($('#modales'), { childList: true });
  });
}

// ---------------------------------------------------------------------
// 5. INICIO DE LA APLICACIÓN, LOGIN Y NAVEGACIÓN
// ---------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  if (document.body.dataset.pagina === 'llamador') return iniciarLlamador();
  // leer colores de la paleta desde el CSS
  const css = getComputedStyle(document.documentElement);
  ['azul', 'rojo', 'verde', 'ambar', 'violeta', 'texto-suave', 'borde'].forEach((c) => { COLOR[c] = css.getPropertyValue('--' + c).trim(); });
  if (window.Chart) {
    Chart.defaults.font.family = "'Lato', 'Segoe UI', Arial, sans-serif";
    Chart.defaults.color = COLOR['texto-suave'];
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
  }

  pintarIconosFijos();
  enlazarEventos();
  const fechaTexto = fmtFechaLarga(hoy());
  $('#fecha-hoy').textContent = fechaTexto[0].toUpperCase() + fechaTexto.slice(1);

  APP.config = await BD.obtenerConfiguracion();
  aplicarMarca();

  // si otra pestaña cierra la sesión, esta se recarga limpia (sin datos en pantalla)
  supabaseClient.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT' && APP.perfil) location.replace(location.pathname);
  });

  iniciarControlInactividad();
  const motivo = new URLSearchParams(location.search).get('motivo');
  if (motivo) history.replaceState(null, '', location.pathname + location.hash);

  const sesion = await verificarSesionDeNavegador();
  if (sesion && inactivoDemasiado()) return cerrarSesion('inactividad');
  if (sesion) await entrar();
  else mostrarLogin(motivo === 'inactividad' ? 'Tu sesión se cerró por inactividad. Ingresá nuevamente.' : undefined);
}

function pintarIconosFijos() {
  $('#btn-menu').innerHTML = icono('menu');
  $('#pacientes-icono-buscar').innerHTML = icono('buscar');
  $('#btn-nuevo-turno').innerHTML = `${icono('mas')} Nuevo turno`;
  $('#btn-nuevo-paciente').innerHTML = `${icono('mas')} Nuevo paciente`;
  $('#btn-nuevo-profesional').innerHTML = `${icono('mas')} Nuevo profesional`;
  $('#btn-nueva-practica').innerHTML = `${icono('mas')} Nueva práctica`;
  $('#btn-nueva-tarifa').innerHTML = `${icono('mas')} Nueva tarifa`;
  $('#btn-nuevo-usuario').innerHTML = `${icono('mas')} Nuevo usuario`;
  $('#btn-imprimir-reporte').innerHTML = `${icono('imprimir')} Imprimir`;
  $('#aud-exportar').innerHTML = `${icono('descargar')} Exportar CSV`;
  $('#btn-llamador').innerHTML = `${icono('pantalla')} <span class="texto-llamador">Llamador</span>`;
  $('#btn-mi-password').innerHTML = `${icono('llave')} Cambiar mi contraseña`;
  $('#btn-logout').innerHTML = `${icono('salir')} Cerrar sesión`;
}

// Nombre y logo de la óptica en todas las pantallas
function aplicarMarca() {
  const nombre = APP.config?.nombre_optica || 'Mi Óptica';
  $$('.js-nombre-optica').forEach((el) => { el.textContent = nombre; });
  document.title = `${nombre} · Sistema de Gestión`;
  const logo = APP.config?.logo_url;
  [['#login-logo-img', '#login-icono'], ['#menu-logo-img', '#menu-icono']].forEach(([img, ico]) => {
    $(img).classList.toggle('oculto', !logo);
    $(ico).classList.toggle('oculto', !!logo);
    if (logo) $(img).src = logo;
  });
}

function mostrarLogin(mensajeError) {
  APP.perfil = null;
  $('#app').classList.add('oculto');
  $('#pantalla-login').classList.remove('oculto');
  $('#modales').innerHTML = '';
  const err = $('#login-error');
  err.classList.toggle('oculto', !mensajeError);
  err.textContent = mensajeError || '';
}

async function entrar() {
  try {
    const perfil = await BD.perfilActual();
    if (!perfil) { await BD.logout(); return mostrarLogin('Tu usuario no tiene un perfil asignado. Consultá con el administrador.'); }
    if (!perfil.activo) { await BD.logout(); return mostrarLogin('Tu usuario está desactivado. Consultá con el administrador.'); }
    APP.perfil = perfil;
    // compromiso de confidencialidad: se acepta una vez antes de ver cualquier dato
    if (!perfil.confidencialidad_aceptada_at) {
      const acepto = await pedirConfidencialidad();
      if (!acepto) return cerrarSesion();
    }
    await cargarCatalogos();
  } catch (e) {
    return mostrarLogin(e.message);
  }

  const p = APP.perfil;
  const nombre = `${p.nombre} ${p.apellido}`.trim() || p.email;
  $('#menu-avatar').textContent = $('#top-avatar').textContent = iniciales(p.nombre || p.email, p.apellido);
  $('#menu-usuario-nombre').textContent = nombre;
  $('#menu-usuario-rol').textContent = ROLES[p.rol];
  $('#top-usuario').textContent = nombre;
  $('#menu-usuario-email').textContent = p.email;

  // valores iniciales de filtros según el rol
  APP.turnos.fecha = hoy();
  APP.turnos.profesionalId = p.rol === 'medico' && p.profesional_id ? String(p.profesional_id) : '';

  armarMenu();
  $('#pantalla-login').classList.add('oculto');
  $('#app').classList.remove('oculto');

  if (p.rol === 'medico' && !p.profesional_id) {
    aviso('Tu usuario de médico no está vinculado a un profesional. Pedile al administrador que lo vincule.', 'error');
  }
  pintarChipConsultorio();
  // el primer ingreso del día, el médico confirma en qué consultorio atiende
  if (p.rol === 'medico' && p.profesionales && p.profesionales.consultorio_fecha !== hoy()) {
    setTimeout(() => modalConsultorio(), 400);
  }
  irA(location.hash || '#inicio');
}

async function cargarCatalogos() {
  [APP.profesionales, APP.practicas, APP.tarifas] = await Promise.all([
    BD.listarProfesionales(), BD.listarPracticas(), BD.listarTarifas(),
  ]);
}

function armarMenu() {
  $('#menu').innerHTML = MENU.filter((m) => m.roles.includes(rol())).map((m) => m.grupo
    ? `<li class="menu-grupo">${esc(m.grupo)}</li>`
    : `<li><a href="#${m.vista}" data-vista="${m.vista}">${icono(m.icono)}<span>${esc(m.texto)}</span></a></li>`
  ).join('');
}

function puedeVerVista(vista) {
  const def = VISTAS[vista];
  if (!def) return false;
  const roles = def.roles || MENU.find((m) => m.vista === vista)?.roles || [];
  return roles.includes(rol());
}

// Navegación por hash: #turnos, #paciente/15, etc.
function irA(hash) {
  if (location.hash !== hash) { location.hash = hash; return; }  // el evento hashchange carga la vista
  mostrarVista();
}
window.addEventListener('hashchange', () => { if (APP.perfil) mostrarVista(); });

async function mostrarVista() {
  let [vista, parametro] = location.hash.slice(1).split('/');
  if (!puedeVerVista(vista)) { vista = 'inicio'; parametro = undefined; history.replaceState(null, '', '#inicio'); }

  const def = VISTAS[vista];
  $$('.vista').forEach((v) => v.classList.toggle('activa', v.id === 'vista-' + vista));
  $$('#menu a').forEach((a) => a.classList.toggle('activo', a.dataset.vista === (def.menu || vista)));
  $('#titulo-vista').textContent = def.titulo;
  $('#app').classList.remove('menu-abierto');
  $('#menu-usuario').classList.add('oculto');
  window.scrollTo(0, 0);
  try { await def.cargar(parametro); } catch (e) { avisoError(e); }
}

function enlazarEventos() {
  // login
  $('#form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btn-login');
    btn.disabled = true; btn.textContent = 'Ingresando…';
    $('#login-error').classList.add('oculto');
    try {
      await BD.login($('#login-email').value.trim(), $('#login-password').value);
      marcarSesionNavegador();
      registrarActividad(true);
      $('#login-password').value = '';
      await entrar();
    } catch (err) {
      mostrarLogin(err.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Ingresar';
    }
  });

  // menú de usuario
  $('#btn-usuario').addEventListener('click', (e) => { e.stopPropagation(); $('#menu-usuario').classList.toggle('oculto'); });
  document.addEventListener('click', () => $('#menu-usuario').classList.add('oculto'));
  $('#btn-logout').addEventListener('click', () => cerrarSesion());
  $('#btn-mi-password').addEventListener('click', modalMiPassword);
  $('#btn-menu').addEventListener('click', () => $('#app').classList.toggle('menu-abierto'));

  // turnos
  $('#turnos-fecha').addEventListener('change', (e) => { APP.turnos.fecha = e.target.value || hoy(); cargarTurnos(); });
  $('#turnos-ant').addEventListener('click', () => { APP.turnos.fecha = sumarDias(APP.turnos.fecha, -1); cargarTurnos(); });
  $('#turnos-sig').addEventListener('click', () => { APP.turnos.fecha = sumarDias(APP.turnos.fecha, 1); cargarTurnos(); });
  $('#turnos-hoy').addEventListener('click', () => { APP.turnos.fecha = hoy(); cargarTurnos(); });
  $('#turnos-profesional').addEventListener('change', (e) => { APP.turnos.profesionalId = e.target.value; cargarTurnos(); });
  $('#turnos-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-estado]');
    if (chip) { APP.turnos.estado = chip.dataset.estado; cargarTurnos(); }
  });
  $('#btn-nuevo-turno').addEventListener('click', () => modalTurno({ fecha: APP.turnos.fecha, profesional_id: APP.turnos.profesionalId }));
  $('#turnos-tabla').addEventListener('click', accionTurno);
  $('#turnos-espera').addEventListener('click', accionTurno);
  $('#btn-llamador').addEventListener('click', abrirLlamador);
  $('#chip-consultorio').addEventListener('click', () => modalConsultorio());

  // la agenda del día se refresca sola para ver a los pacientes que van llegando
  setInterval(() => {
    const enTurnos = location.hash.startsWith('#turnos') && APP.perfil;
    if (enTurnos && APP.turnos.fecha === hoy() && !$('#modales').children.length && !document.hidden) {
      cargarTurnos({ silencioso: true }).catch(() => {});
    }
  }, 20000);

  // pacientes
  $('#pacientes-buscar').addEventListener('input', debounce((e) => {
    APP.pacientes.texto = e.target.value; APP.pacientes.pagina = 0; cargarPacientes();
  }));
  $('#btn-nuevo-paciente').addEventListener('click', () => modalPaciente());
  $('#pacientes-bajas').addEventListener('change', (e) => {
    APP.pacientes.incluirBajas = e.target.checked; APP.pacientes.pagina = 0; cargarPacientes();
  });
  $('#pacientes-tabla').addEventListener('click', accionPaciente);
  $('#pacientes-paginacion').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pagina]');
    if (b) { APP.pacientes.pagina = Number(b.dataset.pagina); cargarPacientes(); }
  });

  // ficha
  $('#ficha-pestanas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pestana]');
    if (b) { APP.ficha.pestana = b.dataset.pestana; pintarFicha(); }
  });
  $('#ficha-cabecera').addEventListener('click', accionFicha);
  $('#ficha-contenido').addEventListener('click', accionFicha);

  // profesionales
  $('#btn-nuevo-profesional').addEventListener('click', () => modalProfesional());
  $('#prof-ver-inactivos').addEventListener('change', pintarProfesionales);
  $('#profesionales-lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-editar-prof]');
    if (b) modalProfesional(APP.profesionales.find((p) => p.id === Number(b.dataset.editarProf)));
  });

  // prácticas y tarifas
  $('#btn-nueva-practica').addEventListener('click', () => modalPractica());
  $('#btn-nueva-tarifa').addEventListener('click', () => modalTarifa());
  $('#tarifas-filtro').addEventListener('change', pintarTarifas);
  $('#practicas-tabla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-editar-practica]');
    if (b) modalPractica(APP.practicas.find((p) => p.id === Number(b.dataset.editarPractica)));
    const t = e.target.closest('[data-tarifa-practica]');
    if (t) modalTarifa({ practica_id: Number(t.dataset.tarifaPractica) });
  });
  $('#tarifas-tabla').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-borrar-tarifa]');
    if (!b) return;
    if (!await confirmar('¿Eliminar esta tarifa del historial?', { peligro: true, textoOk: 'Eliminar' })) return;
    try { await BD.eliminarTarifa(Number(b.dataset.borrarTarifa)); aviso('Tarifa eliminada'); await refrescarTarifas(); }
    catch (err) { avisoError(err); }
  });

  // reportes
  $('#rep-periodo').addEventListener('change', aplicarPeriodoReporte);
  $$('#rep-desde, #rep-hasta').forEach((el) => el.addEventListener('change', () => { $('#rep-periodo').value = 'otro'; }));
  $('#btn-generar-reporte').addEventListener('click', generarReporte);
  $('#btn-imprimir-reporte').addEventListener('click', () => window.print());
  $('#reporte-contenido').addEventListener('click', (e) => {
    const b = e.target.closest('[data-exportar]');
    if (b) exportarReporte(b.dataset.exportar);
  });

  // usuarios
  $('#btn-nuevo-usuario').addEventListener('click', modalNuevoUsuario);
  $('#usuarios-tabla').addEventListener('click', accionUsuario);

  // auditoría
  $('#aud-buscar').addEventListener('click', () => { APP.auditoria.pagina = 0; cargarAuditoria(); });
  $('#aud-exportar').addEventListener('click', exportarAuditoria);
  $('#aud-paginacion').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pagina]');
    if (b) { APP.auditoria.pagina = Number(b.dataset.pagina); cargarAuditoria(); }
  });
  $('#aud-tabla').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver-detalle]');
    if (b) verDetalleAuditoria(Number(b.dataset.verDetalle));
  });

  // configuración
  $('#form-config').addEventListener('submit', guardarConfiguracion);
  $('#form-config [name=logo_url]').addEventListener('input', (e) => previsualizarLogo(e.target.value));
}

// ---------------------------------------------------------------------
// 6. PANTALLA DE INICIO (tablero)
// ---------------------------------------------------------------------
async function cargarInicio() {
  const profesionalId = rol() === 'medico' ? APP.perfil.profesional_id : null;
  $('#inicio-proximos').innerHTML = cargando();
  const r = await BD.resumenInicio({ profesionalId });

  $('#inicio-hoy-total').textContent = `(${r.hoy.total} en total${profesionalId ? ', tu agenda' : ''})`;
  const kpi = (valor, texto, ic, color, estado) => `
    <div class="kpi clic" data-ir-estado="${estado}">
      <div class="valor ${color}">${valor}</div>
      <div class="etiqueta">${icono(ic)} ${texto}</div>
    </div>`;
  $('#inicio-kpis').innerHTML =
    kpi(r.hoy.pendiente, 'Pendientes', 'reloj', 'c-ambar', 'pendiente') +
    kpi(r.hoy.confirmado, 'Confirmados', 'checkCirculo', 'c-azul', 'confirmado') +
    kpi(r.hoy.en_espera, 'En espera', 'usuarios', 'c-violeta', 'en_espera') +
    kpi(r.hoy.atendido, 'Atendidos', 'atender', 'c-verde', 'atendido') +
    kpi(r.hoy.ausente + r.hoy.cancelado, 'Ausentes / cancel.', 'ausente', 'c-rojo', 'ausente');
  $$('#inicio-kpis [data-ir-estado]').forEach((k) => k.addEventListener('click', () => {
    APP.turnos.fecha = hoy(); APP.turnos.estado = k.dataset.irEstado; irA('#turnos');
  }));

  $('#inicio-resumen').innerHTML = `
    <div class="resumen-item"><span>Pacientes registrados</span><strong>${numero(r.totalPacientes)}</strong></div>
    <div class="resumen-item"><span>Turnos próximos 7 días</span><strong>${numero(r.semana)}</strong></div>
    <div class="resumen-item"><span>Profesionales activos</span><strong>${numero(r.profesionalesActivos)}</strong></div>`;

  // próximos turnos
  $('#inicio-proximos').innerHTML = r.proximos.length ? `
    <table class="tabla"><thead><tr><th>Fecha</th><th>Paciente</th><th>Profesional</th><th>Práctica</th><th>Estado</th></tr></thead><tbody>
    ${r.proximos.map((t) => `<tr>
      <td class="hora">${t.fecha === hoy() ? 'Hoy' : fmtFecha(t.fecha).slice(0, 5)} · ${fmtHora(t.hora)}</td>
      <td><a href="#paciente/${t.paciente_id}">${esc(t.paciente)}</a>${t.origen === 'whatsapp' ? ' ' + badgeWhatsapp() : ''}</td>
      <td class="nowrap"><span class="barra-color" style="background:${esc(t.profesional_color)}"></span>${esc(t.profesional)}</td>
      <td>${esc(t.practica)}</td>
      <td>${badgeEstado(t.estado)}</td></tr>`).join('')}
    </tbody></table>` : vacio('No hay turnos próximos.');

  // asistencia del mes
  $('#inicio-asistencia').textContent = r.mes.atendidos + r.mes.ausentes ? r.mes.asistencia + '%' : '—';
  grafico('graf-asistencia', {
    type: 'doughnut',
    data: {
      labels: ['Atendidos', 'Ausentes'],
      datasets: [{ data: r.mes.atendidos + r.mes.ausentes ? [r.mes.atendidos, r.mes.ausentes] : [0, 0, 1],
                   backgroundColor: [COLOR.verde, COLOR.rojo, '#E6ECF1'], borderWidth: 0 }],
    },
    options: { cutout: '72%', maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });
  $('#inicio-mes').innerHTML = `
    <li><span>Turnos del mes</span><strong>${numero(r.mes.total)}</strong></li>
    <li><span class="c-verde">Atendidos</span><strong>${numero(r.mes.atendidos)}</strong></li>
    <li><span class="c-rojo">Ausentes</span><strong>${numero(r.mes.ausentes)}</strong></li>
    <li><span>Pedidos por WhatsApp</span><strong>${numero(r.mes.whatsapp)}</strong></li>`;

  // prácticas más realizadas
  const maxPr = Math.max(1, ...r.mes.topPracticas.map((p) => p.cantidad));
  $('#inicio-practicas').innerHTML = r.mes.topPracticas.length ? `
    <table class="tabla"><thead><tr><th>Práctica</th><th style="width:40%"></th><th class="num">Cant.</th></tr></thead><tbody>
    ${r.mes.topPracticas.map((p) => `<tr><td>${esc(p.nombre)}</td>
      <td><div style="height:8px;border-radius:4px;background:var(--azul);opacity:.85;width:${(p.cantidad / maxPr) * 100}%"></div></td>
      <td class="num"><b>${p.cantidad}</b></td></tr>`).join('')}
    </tbody></table>` : vacio('Todavía no hay prácticas atendidas este mes.');

  // facturación (no se muestra a recepción)
  $('#inicio-tarjeta-facturacion').classList.toggle('oculto', rol() === 'recepcion');
  $('#inicio-facturacion').innerHTML = `
    <div class="dato-grande"><div class="titulo">Facturado (turnos atendidos)</div><div class="valor">${dinero(r.mes.facturacion)}</div></div>
    <div class="dato-grande"><div class="titulo">Ticket promedio</div><div class="valor" style="color:var(--texto)">${dinero(r.mes.atendidos ? r.mes.facturacion / r.mes.atendidos : 0)}</div></div>
    <div class="dato-grande"><div class="titulo">Pacientes nuevos este mes</div><div class="valor" style="color:var(--verde)">${numero(r.pacientesNuevosMes)}</div></div>`;
}

const badgeWhatsapp = () => `<span class="badge badge-whatsapp" title="Pedido por WhatsApp">${icono('whatsapp', 'icono-sm')} WhatsApp</span>`;

// Crea (o reemplaza) un gráfico de Chart.js
function grafico(idCanvas, config) {
  if (!window.Chart) return;
  APP.graficos[idCanvas]?.destroy();
  APP.graficos[idCanvas] = new Chart(document.getElementById(idCanvas), config);
}

// ---------------------------------------------------------------------
// 7. TURNOS
// ---------------------------------------------------------------------
async function cargarTurnos({ silencioso = false } = {}) {
  const f = APP.turnos;
  $('#turnos-fecha').value = f.fecha;
  $('#turnos-profesional').innerHTML = opcionesProfesionales(f.profesionalId, 'Todos los profesionales');
  $('#turnos-titulo').textContent = `Agenda del ${fmtFechaLarga(f.fecha)}`;
  if (!silencioso) $('#turnos-tabla').innerHTML = cargando();

  const turnos = await BD.listarTurnos({ desde: f.fecha, hasta: f.fecha, profesionalId: f.profesionalId || null });

  // chips con cantidad por estado
  const cuenta = turnos.reduce((a, t) => { a[t.estado] = (a[t.estado] || 0) + 1; return a; }, {});
  $('#turnos-chips').innerHTML =
    `<button class="chip ${f.estado === '' ? 'activo' : ''}" data-estado="">Todos <b>${turnos.length}</b></button>` +
    Object.entries(ESTADOS).map(([k, v]) => `
      <button class="chip ${f.estado === k ? 'activo' : ''}" data-estado="${k}">
        <span class="punto" style="background:${v.color}"></span>${v.texto} <b>${cuenta[k] || 0}</b></button>`).join('');

  recordarTurnos(turnos);
  pintarSalaDeEspera(f.fecha === hoy() ? turnos.filter((t) => t.estado === 'en_espera') : []);
  const lista = f.estado ? turnos.filter((t) => t.estado === f.estado) : turnos;
  $('#turnos-tabla').innerHTML = lista.length ? `
    <table class="tabla"><thead><tr>
      <th>Hora</th><th>Paciente</th><th>Profesional</th><th>Práctica</th><th>Estado</th><th class="num">Precio</th><th></th>
    </tr></thead><tbody>${lista.map(filaTurno).join('')}</tbody></table>`
    : vacio(f.estado ? `No hay turnos "${ESTADOS[f.estado].texto.toLowerCase()}" para este día.` : 'No hay turnos para este día.');
}

// Tarjeta "Sala de espera": pacientes que ya llegaron, por orden de llegada
function pintarSalaDeEspera(enEspera) {
  const cont = $('#turnos-espera');
  if (!enEspera.length) { cont.innerHTML = ''; return; }
  enEspera.sort((a, b) => (a.llegada_at || '').localeCompare(b.llegada_at || ''));
  const minutos = (ts) => ts ? Math.max(0, Math.round((Date.now() - new Date(ts)) / 60000)) : null;
  cont.innerHTML = `
    <div class="tarjeta sala-espera">
      <div class="tarjeta-cab"><h3>${icono('usuarios', 'icono-sm')} Sala de espera</h3>
        <span class="badge badge-en_espera">${enEspera.length} paciente${enEspera.length > 1 ? 's' : ''}</span>
        <div class="espacio"></div><span class="ayuda">Se actualiza sola cada 20 segundos</span></div>
      <div class="tarjeta-cuerpo sin-padding tabla-wrap"><table class="tabla"><tbody>
      ${enEspera.map((t) => {
        const m = minutos(t.llegada_at);
        return `<tr>
          <td class="hora" style="width:90px">${fmtHora(t.hora)}<span class="sub">turno</span></td>
          <td><b>${esc(t.paciente)}</b><span class="sub">${esc(t.practica)}</span></td>
          <td class="nowrap"><span class="barra-color" style="background:${esc(t.profesional_color)}"></span>${esc(t.profesional)}</td>
          <td class="nowrap c-suave">${m === null ? '' : `Espera hace ${m} min`}${t.llamado_at ? `<span class="sub c-violeta">Llamado ${new Date(t.llamado_at).toTimeString().slice(0, 5)}</span>` : ''}</td>
          <td><div class="acciones">${puedeAtender(t) ? `
            <button class="btn btn-chico btn-violeta" data-accion="llamar" data-id="${t.id}">${icono('llamar', 'icono-sm')} ${t.llamado_at ? 'Volver a llamar' : 'Llamar'}</button>
            ${puedeVerHC() ? `<button class="btn btn-chico btn-verde" data-accion="atender" data-id="${t.id}">${icono('atender', 'icono-sm')} Atender</button>` : ''}` : ''}
          </div></td></tr>`;
      }).join('')}
      </tbody></table></div>
    </div>`;
}

// Llama al paciente; si el médico no definió consultorio, se lo pide primero
async function llamarTurno(turno) {
  try {
    const ll = await BD.llamarPaciente(turno.id);
    aviso(`Llamando a ${ll.paciente} — Consultorio ${ll.consultorio}`, 'info');
  } catch (err) {
    if (/consultorio/i.test(err.message) && rol() === 'medico') {
      modalConsultorio(() => llamarTurno(turno).then(refrescarVistaActual));
    } else throw err;
  }
}

function filaTurno(t) {
  return `<tr>
    <td class="hora">${fmtHora(t.hora)}<span class="sub">${t.duracion_min} min</span>${infoEspera(t)}</td>
    <td><a href="#paciente/${t.paciente_id}">${esc(t.paciente)}</a>
        <span class="sub">DNI ${esc(t.paciente_dni)}${t.paciente_telefono ? ' · ' + esc(t.paciente_telefono) : ''}</span>
        ${t.origen === 'whatsapp' ? badgeWhatsapp() : ''}</td>
    <td class="nowrap"><span class="barra-color" style="background:${esc(t.profesional_color)}"></span>${esc(t.profesional)}</td>
    <td>${esc(t.practica)}${t.observaciones ? `<span class="sub">${esc(t.observaciones)}</span>` : ''}</td>
    <td>${badgeEstado(t.estado)}</td>
    <td class="num">${dinero(t.precio)}</td>
    <td><div class="acciones">${botonesTurno(t)}</div></td>
  </tr>`;
}

// Hora de llegada y último llamado (para turnos en sala de espera)
function infoEspera(t) {
  if (t.estado !== 'en_espera') return '';
  const hm = (ts) => new Date(ts).toTimeString().slice(0, 5);
  return `<span class="sub c-violeta">${t.llegada_at ? 'Llegó ' + hm(t.llegada_at) : ''}${t.llamado_at ? ' · Llamado ' + hm(t.llamado_at) : ''}</span>`;
}

// Guarda los turnos que se están mostrando, para que los botones de acción los encuentren
function recordarTurnos(lista) {
  APP.turnosVisibles = new Map(lista.map((t) => [t.id, t]));
}

function botonesTurno(t, { conFicha = true } = {}) {
  const b = (accion, ic, titulo, clase = '') =>
    `<button class="btn btn-icono ${clase}" data-accion="${accion}" data-id="${t.id}" title="${titulo}">${icono(ic)}</button>`;
  let h = '';
  // un médico solo gestiona los turnos de su propia agenda
  if (rol() === 'medico' && t.profesional_id !== APP.perfil.profesional_id) {
    return conFicha ? b('ficha', 'ver', 'Ver ficha del paciente') : '';
  }
  if (t.estado === 'pendiente') h += b('confirmar', 'check', 'Confirmar');
  if (['pendiente', 'confirmado'].includes(t.estado) && t.fecha === hoy()) h += b('llego', 'llego', 'Llegó (pasa a la sala de espera)');
  if (t.estado === 'en_espera' && puedeAtender(t)) h += b('llamar', 'llamar', t.llamado_at ? 'Volver a llamar' : 'Llamar al paciente', 'llamar');
  if (['pendiente', 'confirmado', 'en_espera'].includes(t.estado)) {
    if (puedeVerHC() && puedeAtender(t)) h += b('atender', 'atender', 'Atender (registrar consulta)');
    else h += b('atendido', 'atender', 'Marcar como atendido');
    h += b('ausente', 'ausente', 'Marcar ausente');
    h += b('editar', 'editar', 'Editar / reprogramar');
    h += b('cancelar', 'cerrar', 'Cancelar turno', 'peligro');
  }
  if (['cancelado', 'ausente'].includes(t.estado)) h += b('reactivar', 'deshacer', 'Volver a pendiente');
  if (t.estado === 'atendido' && conFicha) h += b('ficha', 'ver', 'Ver ficha del paciente');
  if (esAdmin()) h += b('eliminar', 'borrar', 'Eliminar', 'peligro');
  return h;
}

async function accionTurno(e) {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const id = Number(btn.dataset.id);
  const accion = btn.dataset.accion;
  const turno = APP.turnosVisibles.get(id);
  if (!turno) return;
  try {
    switch (accion) {
      case 'confirmar': await BD.cambiarEstadoTurno(id, 'confirmado'); aviso('Turno confirmado'); break;
      case 'llego': await BD.marcarLlegada(id); aviso(`${turno.paciente} está en la sala de espera`); break;
      case 'llamar': await llamarTurno(turno); break;
      case 'atendido':  await BD.cambiarEstadoTurno(id, 'atendido'); aviso('Turno marcado como atendido'); break;
      case 'reactivar': await BD.cambiarEstadoTurno(id, 'pendiente'); aviso('El turno volvió a pendiente'); break;
      case 'ausente':
        if (!await confirmar(`¿Marcar a <b>${esc(turno.paciente)}</b> como ausente?`, { textoOk: 'Marcar ausente', peligro: true })) return;
        await BD.cambiarEstadoTurno(id, 'ausente'); aviso('Turno marcado como ausente'); break;
      case 'cancelar':
        if (!await confirmar(`¿Cancelar el turno de <b>${esc(turno.paciente)}</b> del ${fmtFecha(turno.fecha)} a las ${fmtHora(turno.hora)}?`,
          { textoOk: 'Cancelar turno', peligro: true })) return;
        await BD.cambiarEstadoTurno(id, 'cancelado'); aviso('Turno cancelado'); break;
      case 'eliminar':
        if (!await confirmar('¿Eliminar definitivamente este turno? Esta acción no se puede deshacer.', { textoOk: 'Eliminar', peligro: true })) return;
        await BD.eliminarTurno(id); aviso('Turno eliminado'); break;
      case 'editar': return modalTurno(turno);
      case 'ficha': return irA(`#paciente/${turno.paciente_id}`);
      case 'atender': {
        const paciente = await BD.obtenerPaciente(turno.paciente_id);
        return modalConsulta({ paciente, turno, alGuardar: refrescarVistaActual });
      }
    }
    refrescarVistaActual();
  } catch (err) { avisoError(err); }
}

function refrescarVistaActual() {
  const [vista, param] = location.hash.slice(1).split('/');
  if (VISTAS[vista]) VISTAS[vista].cargar(param);
  else cargarInicio();
}

/**
 * Formulario de turno (nuevo o edición).
 *  datos: { id?, paciente_id?, paciente?, profesional_id?, practica_id?, fecha?, hora?, ... }
 */
function modalTurno(datos = {}) {
  const editando = !!datos.id;
  let pacienteSel = datos.paciente_id ? { id: datos.paciente_id, texto: datos.paciente } : null;
  let horaSel = datos.hora ? fmtHora(datos.hora) : null;

  const cuerpo = `
    <div class="campo"><label>Paciente <span class="req">*</span></label><div id="t-paciente"></div></div>
    <div class="fila-2">
      <div class="campo"><label>Profesional <span class="req">*</span></label>
        <select name="profesional_id" required>${opcionesProfesionales(datos.profesional_id, 'Seleccionar…')}</select></div>
      <div class="campo"><label>Práctica <span class="req">*</span></label>
        <select name="practica_id" required>${opcionesPracticas(datos.practica_id, 'Seleccionar…')}</select></div>
    </div>
    <div class="fila-2">
      <div class="campo"><label>Fecha <span class="req">*</span></label><input type="date" name="fecha" required value="${esc(datos.fecha || hoy())}"></div>
      <div class="campo"><label>Precio</label><input id="t-precio" disabled value="—"></div>
    </div>
    <div class="campo"><label>Horario <span class="req">*</span></label>
      <div class="horarios" id="t-horarios"></div>
      <label class="check" style="margin:10px 0 0"><input type="checkbox" id="t-manual"> Sobreturno / horario manual</label>
      <input type="time" id="t-hora-manual" class="oculto" style="max-width:160px;margin-top:6px" step="300">
    </div>
    ${editando ? `<div class="campo"><label>Estado</label><select name="estado">${opciones(
      Object.entries(ESTADOS).map(([k, v]) => ({ valor: k, texto: v.texto })), datos.estado)}</select></div>` : ''}
    <div class="campo"><label>Observaciones</label><textarea name="observaciones" rows="2">${esc(datos.observaciones || '')}</textarea></div>`;

  abrirModal({
    titulo: editando ? 'Editar turno' : 'Nuevo turno',
    cuerpo, tam: 'ancho', textoGuardar: editando ? 'Guardar cambios' : 'Dar turno',
    alAbrir: (form) => {
      const selProf = $('[name=profesional_id]', form);
      const selPrac = $('[name=practica_id]', form);
      const inFecha = $('[name=fecha]', form);
      const manual = $('#t-manual', form);
      const horaManual = $('#t-hora-manual', form);

      selectorPaciente($('#t-paciente', form), pacienteSel, (p) => { pacienteSel = p; });

      const actualizarPrecio = () => {
        const precio = BD.precioVigente(APP.tarifas, Number(selPrac.value), Number(selProf.value), inFecha.value);
        $('#t-precio', form).value = selPrac.value ? (precio === null ? 'Sin tarifa cargada' : dinero(precio)) : '—';
      };

      const cargarHorarios = async () => {
        const cont = $('#t-horarios', form);
        actualizarPrecio();
        if (!selProf.value || !inFecha.value) { cont.innerHTML = '<span class="ayuda">Elegí profesional y fecha para ver los horarios libres.</span>'; return; }
        cont.innerHTML = '<span class="ayuda">Buscando horarios…</span>';
        try {
          let libres = await BD.turnosDisponibles(Number(selProf.value), inFecha.value);
          // al editar, el horario actual del turno también es válido
          if (editando && Number(selProf.value) === datos.profesional_id && inFecha.value === datos.fecha) {
            libres = [...new Set([...libres, fmtHora(datos.hora)])].sort();
          }
          if (horaSel && !libres.includes(horaSel) && !manual.checked) horaSel = null;
          cont.innerHTML = libres.length
            ? libres.map((h) => `<button type="button" data-hora="${h}" class="${h === horaSel ? 'activo' : ''}">${h}</button>`).join('')
            : '<span class="ayuda">No hay horarios libres ese día (el profesional no atiende o la agenda está completa). Podés usar un sobreturno.</span>';
        } catch (err) { cont.innerHTML = `<span class="ayuda">${esc(err.message)}</span>`; }
      };

      $('#t-horarios', form).addEventListener('click', (e) => {
        const b = e.target.closest('[data-hora]');
        if (!b) return;
        horaSel = b.dataset.hora;
        $$('#t-horarios button', form).forEach((x) => x.classList.toggle('activo', x === b));
      });
      manual.addEventListener('change', () => {
        horaManual.classList.toggle('oculto', !manual.checked);
        $('#t-horarios', form).style.opacity = manual.checked ? .4 : 1;
        if (manual.checked) horaManual.focus();
      });
      selProf.addEventListener('change', cargarHorarios);
      inFecha.addEventListener('change', cargarHorarios);
      selPrac.addEventListener('change', actualizarPrecio);
      cargarHorarios();
    },
    onGuardar: async (d, form) => {
      const manual = $('#t-manual', form).checked;
      const hora = manual ? $('#t-hora-manual', form).value : horaSel;
      if (!pacienteSel) throw new Error('Seleccioná un paciente.');
      if (!hora) throw new Error('Seleccioná un horario.');
      const turno = {
        paciente_id: pacienteSel.id,
        profesional_id: Number(d.profesional_id),
        practica_id: Number(d.practica_id),
        fecha: d.fecha,
        hora,
        observaciones: d.observaciones || null,
      };
      if (editando) {
        turno.id = datos.id;
        turno.estado = d.estado;
        // si cambió la práctica o el profesional, la base recalcula duración y precio
        if (turno.practica_id !== datos.practica_id || turno.profesional_id !== datos.profesional_id) {
          turno.precio = null; turno.duracion_min = null;
        }
      }
      await BD.guardarTurno(turno);
      aviso(editando ? 'Turno actualizado' : 'Turno registrado');
      if (!editando && rol() !== 'medico') { APP.turnos.fecha = turno.fecha; }
      refrescarVistaActual();
    },
  });
}

// Buscador de pacientes reutilizable dentro de formularios
function selectorPaciente(contenedor, inicial, alCambiar) {
  const pintarSeleccionado = (p) => {
    contenedor.innerHTML = `<div class="seleccionado"><span>${icono('usuario')} <b>${esc(p.texto)}</b></span>
      <button type="button" class="btn btn-sec btn-chico" data-cambiar>Cambiar</button></div>`;
    $('[data-cambiar]', contenedor).addEventListener('click', () => { alCambiar(null); pintarBuscador(); });
  };
  const pintarBuscador = () => {
    contenedor.innerHTML = `
      <div style="display:flex;gap:8px">
        <div class="buscador" style="flex:1">${icono('buscar')}<input type="search" placeholder="Apellido, nombre o DNI…" data-buscar></div>
        <button type="button" class="btn btn-sec" data-nuevo>${icono('mas')} Nuevo</button>
      </div>
      <div class="resultados oculto"></div>`;
    const input = $('[data-buscar]', contenedor);
    const res = $('.resultados', contenedor);
    input.addEventListener('input', debounce(async () => {
      const t = input.value.trim();
      if (t.length < 2) { res.classList.add('oculto'); return; }
      try {
        const { filas } = await BD.buscarPacientes(t, { porPagina: 8 });
        res.classList.remove('oculto');
        res.innerHTML = filas.length
          ? filas.map((p) => `<button type="button" data-id="${p.id}" data-texto="${esc(`${p.apellido}, ${p.nombre}`)}">
              <span>${esc(p.apellido)}, ${esc(p.nombre)}</span><span class="c-suave">DNI ${esc(p.dni)}</span></button>`).join('')
          : '<div class="vacio" style="padding:14px">Sin resultados. Podés cargarlo con “Nuevo”.</div>';
      } catch (err) { avisoError(err); }
    }, 250));
    res.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const p = { id: Number(b.dataset.id), texto: b.dataset.texto };
      alCambiar(p); pintarSeleccionado(p);
    });
    $('[data-nuevo]', contenedor).addEventListener('click', () => modalPaciente(null, (nuevo) => {
      const p = { id: nuevo.id, texto: `${nuevo.apellido}, ${nuevo.nombre}` };
      alCambiar(p); pintarSeleccionado(p);
    }));
  };
  if (inicial) pintarSeleccionado(inicial); else pintarBuscador();
}

// ---------------------------------------------------------------------
// 8. PACIENTES
// ---------------------------------------------------------------------
async function cargarPacientes() {
  const { texto, pagina, porPagina } = APP.pacientes;
  if ($('#pacientes-buscar').value !== texto) $('#pacientes-buscar').value = texto;
  $('#pacientes-tabla').innerHTML = cargando();
  const { filas, total } = await BD.buscarPacientes(texto, { pagina, porPagina, incluirBajas: APP.pacientes.incluirBajas });

  $('#pacientes-total').textContent = `${numero(total)} paciente${total === 1 ? '' : 's'}`;
  $('#pacientes-tabla').innerHTML = filas.length ? `
    <table class="tabla"><thead><tr>
      <th>Paciente</th><th>DNI</th><th>Edad</th><th>Teléfono</th><th>Obra social</th><th>Localidad</th><th></th>
    </tr></thead><tbody>
    ${filas.map((p) => `<tr>
      <td><a href="#paciente/${p.id}"><b>${esc(p.apellido)}</b>, ${esc(p.nombre)}</a>
        ${!p.activo ? '<span class="badge badge-inactivo">Baja</span>' : ''}
        ${p.activo && !p.consentimiento_datos ? '<span class="badge badge-pendiente" title="Falta el consentimiento firmado de datos personales">Sin consentimiento</span>' : ''}
        ${p.email ? `<span class="sub">${esc(p.email)}</span>` : ''}</td>
      <td>${esc(p.dni)}</td>
      <td>${edad(p.fecha_nacimiento) ?? '—'}</td>
      <td>${esc(p.telefono || '—')}</td>
      <td>${esc(p.obra_social || '—')}</td>
      <td>${esc(p.localidad || '—')}</td>
      <td><div class="acciones">
        <button class="btn btn-icono" data-accion="ficha" data-id="${p.id}" title="Ver ficha">${icono('ver')}</button>
        ${p.activo ? `<button class="btn btn-icono" data-accion="turno" data-id="${p.id}" data-texto="${esc(`${p.apellido}, ${p.nombre}`)}" title="Dar turno">${icono('calendario')}</button>` : ''}
        <button class="btn btn-icono" data-accion="editar" data-id="${p.id}" title="Editar">${icono('editar')}</button>
        ${esAdmin() ? (p.activo
          ? `<button class="btn btn-icono peligro" data-accion="baja" data-id="${p.id}" data-texto="${esc(`${p.apellido}, ${p.nombre}`)}" title="Dar de baja">${icono('ausente')}</button>`
          : `<button class="btn btn-icono" data-accion="reactivar" data-id="${p.id}" title="Reactivar">${icono('deshacer')}</button>`) : ''}
      </div></td></tr>`).join('')}
    </tbody></table>` : vacio(texto ? 'No se encontraron pacientes con ese criterio.' : 'Todavía no hay pacientes cargados.');

  const paginas = Math.max(1, Math.ceil(total / porPagina));
  $('#pacientes-paginacion').innerHTML = `
    <span>Página ${pagina + 1} de ${paginas}</span>
    <div class="acciones">
      <button class="btn btn-sec btn-chico" data-pagina="${pagina - 1}" ${pagina === 0 ? 'disabled' : ''}>‹ Anterior</button>
      <button class="btn btn-sec btn-chico" data-pagina="${pagina + 1}" ${pagina + 1 >= paginas ? 'disabled' : ''}>Siguiente ›</button>
    </div>`;
}

async function accionPaciente(e) {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const id = Number(b.dataset.id);
  try {
    switch (b.dataset.accion) {
      case 'ficha': return irA(`#paciente/${id}`);
      case 'turno': return modalTurno({ paciente_id: id, paciente: b.dataset.texto, fecha: hoy() });
      case 'editar': return modalPaciente(await BD.obtenerPaciente(id), cargarPacientes);
      case 'baja': return modalBajaPaciente(id, b.dataset.texto, cargarPacientes);
      case 'reactivar':
        await BD.reactivarPaciente(id);
        aviso('Paciente reactivado');
        cargarPacientes();
    }
  } catch (err) { avisoError(err); }
}

function modalPaciente(p = null, alGuardar = null) {
  const v = (k) => esc(p?.[k] ?? '');
  abrirModal({
    titulo: p ? 'Editar paciente' : 'Nuevo paciente', tam: 'ancho',
    cuerpo: `
      <div class="seccion-form">Datos personales</div>
      <div class="fila-3">
        <div class="campo"><label>DNI <span class="req">*</span></label><input name="dni" required pattern="[0-9A-Za-z.\\-]{6,12}" title="Entre 6 y 12 caracteres" value="${v('dni')}"></div>
        <div class="campo"><label>Apellido <span class="req">*</span></label><input name="apellido" required value="${v('apellido')}"></div>
        <div class="campo"><label>Nombre <span class="req">*</span></label><input name="nombre" required value="${v('nombre')}"></div>
      </div>
      <div class="fila-3">
        <div class="campo"><label>Fecha de nacimiento</label><input type="date" name="fecha_nacimiento" max="${hoy()}" value="${v('fecha_nacimiento')}"></div>
        <div class="campo"><label>Sexo</label><select name="sexo">${opciones([{ valor: 'F', texto: 'Femenino' }, { valor: 'M', texto: 'Masculino' }, { valor: 'X', texto: 'No binario' }], p?.sexo, { vacioTexto: '—' })}</select></div>
        <div class="campo"><label>Teléfono / WhatsApp</label><input name="telefono" type="tel" value="${v('telefono')}" placeholder="11 5555-5555"></div>
      </div>
      <div class="fila-3">
        <div class="campo"><label>Email</label><input name="email" type="email" value="${v('email')}"></div>
        <div class="campo"><label>Dirección</label><input name="direccion" value="${v('direccion')}"></div>
        <div class="campo"><label>Localidad</label><input name="localidad" value="${v('localidad')}"></div>
      </div>
      <div class="seccion-form">Cobertura</div>
      <div class="fila-2">
        <div class="campo"><label>Obra social / prepaga</label><input name="obra_social" list="lista-obras" value="${v('obra_social')}">
          <datalist id="lista-obras">${OBRAS_SOCIALES.map((o) => `<option value="${esc(o)}">`).join('')}</datalist></div>
        <div class="campo"><label>Nº de afiliado</label><input name="nro_afiliado" value="${v('nro_afiliado')}"></div>
      </div>
      <div class="campo"><label>Observaciones</label><textarea name="observaciones" rows="2">${v('observaciones')}</textarea></div>
      ${p ? '' : `<label class="check"><input type="checkbox" name="consentimiento"> El paciente firmó el consentimiento de datos personales</label>
        <div class="ayuda" style="margin-top:-8px">Si todavía no lo firmó, podés imprimir el formulario desde su ficha y registrarlo después.</div>`}`,
    onGuardar: async (d) => {
      const { consentimiento, ...datos } = d;
      const guardado = await BD.guardarPaciente({ ...datos, id: p?.id });
      if (!p && consentimiento) await BD.registrarConsentimiento(guardado.id, true);
      aviso(p ? 'Paciente actualizado' : 'Paciente registrado');
      if (alGuardar) alGuardar(guardado);
      else if (location.hash.startsWith('#pacientes')) cargarPacientes();
    },
  });
}

// ---------------------------------------------------------------------
// 9. FICHA DEL PACIENTE E HISTORIA CLÍNICA
// ---------------------------------------------------------------------
async function cargarFicha(id) {
  $('#ficha-cabecera').innerHTML = cargando();
  $('#ficha-contenido').innerHTML = '';
  const paciente = await BD.obtenerPaciente(Number(id));
  BD.registrarAcceso('ver', 'pacientes', paciente.id);
  if (APP.ficha.paciente?.id !== paciente.id) APP.ficha.pestana = null;
  APP.ficha.paciente = paciente;
  APP.ficha.pestana ||= puedeVerHC() ? 'historia' : 'turnos';
  pintarCabeceraFicha();
  pintarFicha();
}

function pintarCabeceraFicha() {
  const p = APP.ficha.paciente;
  const e = edad(p.fecha_nacimiento);
  $('#ficha-cabecera').innerHTML = `
    <div class="ficha-cab">
      <div class="avatar">${esc(iniciales(p.nombre, p.apellido))}</div>
      <div style="flex:1;min-width:220px">
        <h2>${esc(p.apellido)}, ${esc(p.nombre)}</h2>
        <div class="ficha-datos">
          <span>DNI <b>${esc(p.dni)}</b></span>
          ${e !== null ? `<span>Edad <b>${e} años</b></span>` : ''}
          ${p.telefono ? `<span>${icono('telefono', 'icono-sm')} ${esc(p.telefono)}</span>` : ''}
          <span>Cobertura <b>${esc(p.obra_social || 'Sin datos')}</b>${p.nro_afiliado ? ` · ${esc(p.nro_afiliado)}` : ''}</span>
        </div>
      </div>
      <div class="acciones" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-sec" data-ficha="editar">${icono('editar')} Editar</button>
        ${p.activo ? `<button class="btn btn-sec" data-ficha="turno">${icono('calendario')} Dar turno</button>` : ''}
        ${puedeVerHC() ? `<button class="btn btn-sec" data-ficha="imprimir-hc">${icono('imprimir')} Imprimir historia clínica</button>` : ''}
        ${puedeVerHC() && p.activo && (esAdmin() || APP.perfil.profesional_id) ? `<button class="btn" data-ficha="consulta">${icono('mas')} Nueva consulta</button>` : ''}
      </div>
    </div>
    <div class="ficha-legal">
      ${p.activo ? '' : `<div class="legal-item baja">${icono('ausente', 'icono-sm')}
        <span><b>Paciente dado de baja</b> el ${fmtFechaHora(p.fecha_baja)}${p.motivo_baja ? ` · Motivo: ${esc(p.motivo_baja)}` : ''}.
        Su historia clínica se conserva por ley.</span>
        ${esAdmin() ? '<button class="btn btn-sec btn-chico" data-ficha="reactivar">Reactivar</button>' : ''}</div>`}
      <div class="legal-item ${p.consentimiento_datos ? 'ok' : 'pendiente'}">${icono(p.consentimiento_datos ? 'checkCirculo' : 'reloj', 'icono-sm')}
        <span>${p.consentimiento_datos
          ? `<b>Consentimiento de datos firmado</b> · registrado el ${fmtFechaHora(p.consentimiento_fecha)} por ${esc(p.consentimiento_registrado_por || '—')}`
          : `<b>Falta el consentimiento de datos personales</b>${p.consentimiento_fecha ? ` (revocado el ${fmtFechaHora(p.consentimiento_fecha)})` : ''}. Imprimí el formulario, hacelo firmar y registralo.`}</span>
        <button class="btn btn-sec btn-chico" data-ficha="form-consentimiento">${icono('imprimir', 'icono-sm')} Formulario</button>
        ${!p.consentimiento_datos ? `<button class="btn btn-chico btn-verde" data-ficha="registrar-consentimiento">${icono('check', 'icono-sm')} Registrar firmado</button>`
          : esAdmin() ? '<button class="btn btn-sec btn-chico" data-ficha="revocar-consentimiento">Revocar</button>' : ''}
      </div>
      ${esAdmin() && p.activo ? `<div class="legal-acciones"><button class="btn btn-sec btn-chico peligro-texto" data-ficha="baja">${icono('ausente', 'icono-sm')} Dar de baja</button></div>` : ''}
    </div>`;
  const pestanas = [
    puedeVerHC() && ['historia', 'Historia clínica'],
    ['turnos', 'Turnos'],
    ['datos', 'Datos personales'],
    esAdmin() && ['accesos', 'Registro de accesos'],
  ].filter(Boolean);
  $('#ficha-pestanas').innerHTML = pestanas.map(([k, t]) =>
    `<button data-pestana="${k}" class="${APP.ficha.pestana === k ? 'activa' : ''}">${t}</button>`).join('');
}

async function pintarFicha() {
  const p = APP.ficha.paciente;
  $$('#ficha-pestanas button').forEach((b) => b.classList.toggle('activa', b.dataset.pestana === APP.ficha.pestana));
  const cont = $('#ficha-contenido');
  cont.innerHTML = cargando();

  if (APP.ficha.pestana === 'historia') {
    const consultas = await BD.listarConsultas(p.id);
    APP.ficha.consultas = consultas;
    BD.registrarAcceso('ver', 'consultas', p.id, { consultas: consultas.length });
    cont.innerHTML = consultas.length
      ? `<div class="linea-tiempo">${consultas.map(tarjetaConsulta).join('')}</div>`
      : vacio('El paciente todavía no tiene consultas registradas.');
  }

  if (APP.ficha.pestana === 'turnos') {
    const turnos = await BD.turnosDePaciente(p.id);
    recordarTurnos(turnos);
    cont.innerHTML = turnos.length ? `<div class="tabla-wrap"><table class="tabla"><thead><tr>
        <th>Fecha</th><th>Hora</th><th>Profesional</th><th>Práctica</th><th>Estado</th><th class="num">Precio</th><th></th></tr></thead><tbody>
      ${turnos.map((t) => `<tr>
        <td>${fmtFecha(t.fecha)}</td><td class="hora">${fmtHora(t.hora)}</td>
        <td class="nowrap"><span class="barra-color" style="background:${esc(t.profesional_color)}"></span>${esc(t.profesional)}</td>
        <td>${esc(t.practica)} ${t.origen === 'whatsapp' ? badgeWhatsapp() : ''}</td>
        <td>${badgeEstado(t.estado)}</td><td class="num">${dinero(t.precio)}</td>
        <td><div class="acciones">${botonesTurno(t, { conFicha: false })}</div></td>
      </tr>`).join('')}</tbody></table></div>` : vacio('El paciente no tiene turnos.');
  }

  if (APP.ficha.pestana === 'accesos') {
    const { filas } = await BD.listarAuditoria({ pacienteId: p.id, porPagina: 100 });
    cont.innerHTML = `<p class="ayuda" style="margin:0 0 12px">Quién consultó, imprimió o modificó información de este paciente (últimos 100 registros).</p>
      <div class="tabla-wrap">${tablaAuditoria(filas, { conPaciente: false })}</div>`;
  }

  if (APP.ficha.pestana === 'datos') {
    const fila = (k, v) => `<dt>${k}</dt><dd>${esc(v || '—')}</dd>`;
    cont.innerHTML = `<div class="consulta" style="border:0;padding:0"><dl>
      ${fila('Apellido y nombre', `${p.apellido}, ${p.nombre}`)}
      ${fila('DNI', p.dni)}
      ${fila('Fecha de nacimiento', fmtFecha(p.fecha_nacimiento))}
      ${fila('Sexo', { F: 'Femenino', M: 'Masculino', X: 'No binario' }[p.sexo])}
      ${fila('Teléfono', p.telefono)}
      ${fila('Email', p.email)}
      ${fila('Dirección', [p.direccion, p.localidad].filter(Boolean).join(', '))}
      ${fila('Obra social', p.obra_social)}
      ${fila('Nº de afiliado', p.nro_afiliado)}
      ${fila('Observaciones', p.observaciones)}
      ${fila('Alta en el sistema', fmtFechaHora(p.created_at))}
    </dl></div>
    ${esAdmin() ? `<div class="ayuda" style="margin-top:18px;border-top:1px solid var(--gris-claro);padding-top:12px">
      Solo se puede eliminar definitivamente un paciente cargado por error, que nunca tuvo turnos ni historia clínica.
      <button class="btn btn-sec btn-chico peligro-texto" data-ficha="eliminar" style="margin-left:8px">${icono('borrar', 'icono-sm')} Eliminar definitivamente</button></div>` : ''}`;
  }
}

function tarjetaConsulta(c) {
  const prof = c.profesionales ? `${c.profesionales.apellido}, ${c.profesionales.nombre}` : '';
  const item = (t, v) => v ? `<dt>${t}</dt><dd>${esc(v)}</dd>` : '';
  const av = (c.av_od_sc || c.av_oi_sc || c.av_od_cc || c.av_oi_cc)
    ? `OD ${c.av_od_sc || '—'} sc / ${c.av_od_cc || '—'} cc · OI ${c.av_oi_sc || '—'} sc / ${c.av_oi_cc || '—'} cc` : '';
  const pio = (c.pio_od || c.pio_oi) ? `OD ${c.pio_od ?? '—'} · OI ${c.pio_oi ?? '—'} mmHg` : '';
  return `
    <div class="consulta">
      <div class="consulta-cab">
        <div><div class="fecha">${fmtFechaHora(c.fecha)}</div>
          <div class="prof">${esc(prof)}${c.profesionales?.especialidad ? ' · ' + esc(c.profesionales.especialidad) : ''}</div></div>
        <div class="acciones" style="align-items:center;gap:6px">
          ${puedeEditarConsulta(c) && consultaEditable(c) ? `<span class="ayuda">Editable hasta ${fmtFechaHora(limiteEdicion(c))}</span>
            <button class="btn btn-icono" data-ficha="editar-consulta" data-id="${c.id}" title="Editar consulta">${icono('editar')}</button>` : ''}
          ${puedeVerHC() && !consultaEditable(c) ? `<span class="badge badge-neutro" title="Pasaron más de ${HORAS_EDICION_HC} h: el registro es inalterable">${icono('escudo', 'icono-sm')} Cerrada</span>` : ''}
          ${puedeVerHC() ? `<button class="btn btn-sec btn-chico" data-ficha="enmienda" data-id="${c.id}" title="Agregar una corrección o aclaración">${icono('mas', 'icono-sm')} Enmienda</button>` : ''}
        </div>
      </div>
      <dl>
        ${item('Motivo', c.motivo)}
        ${item('Antecedentes', c.antecedentes)}
        ${item('Agudeza visual', av)}
        ${item('Presión ocular', pio)}
        ${item('Diagnóstico', c.diagnostico)}
        ${item('Indicaciones', c.indicaciones)}
        ${item('Observaciones', c.observaciones)}
      </dl>
      ${(c.recetas || []).map((r) => `
        <div class="receta-titulo">${icono('anteojos', 'icono-sm')} Receta · ${esc(TIPOS_RECETA[r.tipo] || r.tipo)}
          <button class="btn btn-sec btn-chico" data-ficha="imprimir-receta" data-id="${c.id}" data-receta="${r.id}">${icono('imprimir', 'icono-sm')} Imprimir</button></div>
        ${tablaReceta(r)}
        ${r.observaciones ? `<div class="ayuda" style="margin-top:6px">${esc(r.observaciones)}</div>` : ''}`).join('')}
      ${(c.enmiendas_hc || []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((en) => `
        <div class="enmienda">
          <div class="enmienda-cab">${icono('editar', 'icono-sm')} <b>Enmienda</b> · ${fmtFechaHora(en.created_at)} · ${esc(en.autor || '—')}</div>
          <div>${esc(en.texto)}</div>
        </div>`).join('')}
    </div>`;
}

function tablaReceta(r) {
  return `<table class="tabla-receta">
    <tr><th></th><th>Esfera</th><th>Cilindro</th><th>Eje</th><th>Adición</th></tr>
    <tr><td>OD</td><td>${grad(r.od_esfera)}</td><td>${grad(r.od_cilindro)}</td><td>${r.od_eje ?? '—'}${r.od_eje != null ? '°' : ''}</td><td>${grad(r.od_adicion)}</td></tr>
    <tr><td>OI</td><td>${grad(r.oi_esfera)}</td><td>${grad(r.oi_cilindro)}</td><td>${r.oi_eje ?? '—'}${r.oi_eje != null ? '°' : ''}</td><td>${grad(r.oi_adicion)}</td></tr>
    ${r.dip ? `<tr><td>DIP</td><td colspan="4">${numero(r.dip, 1)} mm</td></tr>` : ''}
  </table>`;
}

async function accionFicha(e) {
  const b = e.target.closest('[data-ficha]');
  if (!b) {
    // botones de turnos dentro de la pestaña "Turnos"
    if (e.target.closest('[data-accion]')) accionTurno(e);
    return;
  }
  const p = APP.ficha.paciente;
  switch (b.dataset.ficha) {
    case 'editar':
      return modalPaciente(p, (g) => { APP.ficha.paciente = g; pintarCabeceraFicha(); pintarFicha(); });
    case 'turno':
      return modalTurno({ paciente_id: p.id, paciente: `${p.apellido}, ${p.nombre}`, fecha: hoy() });
    case 'consulta':
      return modalConsulta({ paciente: p, alGuardar: () => { APP.ficha.pestana = 'historia'; pintarFicha(); } });
    case 'imprimir-hc': return imprimirHistoriaClinica(p);
    case 'form-consentimiento': return imprimirConsentimiento(p);
    case 'registrar-consentimiento':
      if (!await confirmar(`¿Confirmás que <b>${esc(p.apellido)}, ${esc(p.nombre)}</b> firmó el consentimiento de datos personales? Guardá el formulario firmado en papel.`,
        { textoOk: 'Registrar' })) return;
      try { await BD.registrarConsentimiento(p.id, true); aviso('Consentimiento registrado'); await recargarFicha(); } catch (err) { avisoError(err); }
      return;
    case 'revocar-consentimiento':
      if (!await confirmar('¿Registrar que el paciente <b>revocó</b> su consentimiento? Su historia clínica se conserva igual por obligación legal.', { textoOk: 'Revocar', peligro: true })) return;
      try { await BD.registrarConsentimiento(p.id, false); aviso('Revocación registrada'); await recargarFicha(); } catch (err) { avisoError(err); }
      return;
    case 'baja': return modalBajaPaciente(p.id, `${p.apellido}, ${p.nombre}`, recargarFicha);
    case 'reactivar':
      try { await BD.reactivarPaciente(p.id); aviso('Paciente reactivado'); await recargarFicha(); } catch (err) { avisoError(err); }
      return;
    case 'eliminar':
      if (!await confirmar(`¿Eliminar definitivamente a <b>${esc(p.apellido)}, ${esc(p.nombre)}</b>? Solo es posible si nunca tuvo turnos ni historia clínica.`,
        { textoOk: 'Eliminar', peligro: true })) return;
      try { await BD.eliminarPaciente(p.id); aviso('Paciente eliminado'); irA('#pacientes'); } catch (err) { avisoError(err); }
      return;
    case 'enmienda': {
      const c = APP.ficha.consultas.find((x) => x.id === Number(b.dataset.id));
      return modalEnmienda(c);
    }
    case 'editar-consulta': {
      const c = APP.ficha.consultas.find((x) => x.id === Number(b.dataset.id));
      return modalConsulta({ paciente: p, consulta: c, alGuardar: pintarFicha });
    }
    case 'imprimir-receta': {
      const c = APP.ficha.consultas.find((x) => x.id === Number(b.dataset.id));
      const r = c.recetas.find((x) => x.id === Number(b.dataset.receta));
      return imprimirReceta(p, c, r);
    }
  }
}

/**
 * Formulario de consulta (historia clínica) con receta opcional.
 *  paciente, consulta? (para editar), turno? (si se atiende desde la agenda)
 */
function modalConsulta({ paciente, consulta = null, turno = null, alGuardar }) {
  const c = consulta || {};
  const r = consulta?.recetas?.[0] || null;
  const v = (k) => esc(c[k] ?? '');
  const rv = (k) => esc(r?.[k] ?? '');
  const profId = c.profesional_id || turno?.profesional_id || APP.perfil.profesional_id || '';
  const ahora = new Date(c.fecha || Date.now());
  const fechaLocal = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const ojo = (lado, etiqueta) => `
    <div class="ojo">${etiqueta}</div>
    <input type="number" name="r_${lado}_esfera" step="0.25" min="-30" max="30" value="${rv(lado + '_esfera')}" placeholder="0,00">
    <input type="number" name="r_${lado}_cilindro" step="0.25" min="-10" max="10" value="${rv(lado + '_cilindro')}" placeholder="0,00">
    <input type="number" name="r_${lado}_eje" step="1" min="0" max="180" value="${rv(lado + '_eje')}" placeholder="0">
    <input type="number" name="r_${lado}_adicion" step="0.25" min="0" max="4" value="${rv(lado + '_adicion')}" placeholder="0,00">`;

  abrirModal({
    titulo: `${consulta ? 'Editar consulta' : 'Nueva consulta'} · ${paciente.apellido}, ${paciente.nombre}`,
    tam: 'ancho', textoGuardar: turno ? 'Guardar y marcar atendido' : 'Guardar consulta',
    cuerpo: `
      ${turno ? `<div class="nota" style="margin-bottom:14px">Turno de las ${fmtHora(turno.hora)} · ${esc(turno.practica)}. Al guardar, el turno queda como <b>atendido</b>.</div>` : ''}
      <div class="fila-2">
        <div class="campo"><label>Profesional <span class="req">*</span></label>
          <select name="profesional_id" required ${esAdmin() ? '' : 'disabled'}>${opcionesProfesionales(profId, 'Seleccionar…', false)}</select></div>
        <div class="campo"><label>Fecha y hora <span class="req">*</span></label><input type="datetime-local" name="fecha" required value="${fechaLocal}"></div>
      </div>
      <div class="campo"><label>Motivo de consulta <span class="req">*</span></label><input name="motivo" required value="${v('motivo')}"></div>
      <div class="campo"><label>Antecedentes</label><textarea name="antecedentes" rows="2">${v('antecedentes')}</textarea></div>

      <div class="seccion-form">Examen</div>
      <div class="fila-4">
        <div class="campo"><label>AV OD sin corrección</label><input name="av_od_sc" value="${v('av_od_sc')}" placeholder="10/10"></div>
        <div class="campo"><label>AV OI sin corrección</label><input name="av_oi_sc" value="${v('av_oi_sc')}" placeholder="10/10"></div>
        <div class="campo"><label>AV OD con corrección</label><input name="av_od_cc" value="${v('av_od_cc')}" placeholder="10/10"></div>
        <div class="campo"><label>AV OI con corrección</label><input name="av_oi_cc" value="${v('av_oi_cc')}" placeholder="10/10"></div>
      </div>
      <div class="fila-4">
        <div class="campo"><label>PIO OD (mmHg)</label><input type="number" step="0.5" min="0" max="80" name="pio_od" value="${v('pio_od')}"></div>
        <div class="campo"><label>PIO OI (mmHg)</label><input type="number" step="0.5" min="0" max="80" name="pio_oi" value="${v('pio_oi')}"></div>
      </div>
      <div class="campo"><label>Diagnóstico</label><textarea name="diagnostico" rows="2">${v('diagnostico')}</textarea></div>
      <div class="fila-2">
        <div class="campo"><label>Indicaciones</label><textarea name="indicaciones" rows="2">${v('indicaciones')}</textarea></div>
        <div class="campo"><label>Observaciones</label><textarea name="observaciones" rows="2">${v('observaciones')}</textarea></div>
      </div>

      <div class="seccion-form">Receta / graduación</div>
      <label class="check"><input type="checkbox" id="c-con-receta" ${r ? 'checked' : ''}> Incluir receta en esta consulta</label>
      <div id="c-receta" class="${r ? '' : 'oculto'}">
        <div class="fila-2">
          <div class="campo"><label>Tipo</label><select name="r_tipo">${opciones(Object.entries(TIPOS_RECETA).map(([k, t]) => ({ valor: k, texto: t })), r?.tipo || 'lejos')}</select></div>
          <div class="campo"><label>Distancia interpupilar (mm)</label><input type="number" name="r_dip" step="0.5" min="40" max="80" value="${rv('dip')}"></div>
        </div>
        <div class="grilla-receta">
          <span></span><span class="cab">Esfera</span><span class="cab">Cilindro</span><span class="cab">Eje (°)</span><span class="cab">Adición</span>
          ${ojo('od', 'OD')}${ojo('oi', 'OI')}
        </div>
        <div class="campo"><label>Observaciones de la receta</label><input name="r_observaciones" value="${rv('observaciones')}" placeholder="Ej.: antirreflejo, fotocromático…"></div>
      </div>`,
    alAbrir: (form) => {
      $('#c-con-receta', form).addEventListener('change', (e) => $('#c-receta', form).classList.toggle('oculto', !e.target.checked));
    },
    onGuardar: async (d, form) => {
      const profesional = Number($('[name=profesional_id]', form).value);
      if (!profesional) throw new Error('Seleccioná el profesional.');
      const consultaNueva = {
        id: consulta?.id,
        paciente_id: paciente.id,
        profesional_id: profesional,
        turno_id: consulta?.turno_id ?? turno?.id ?? null,
        fecha: new Date(d.fecha).toISOString(),
      };
      ['motivo', 'antecedentes', 'av_od_sc', 'av_oi_sc', 'av_od_cc', 'av_oi_cc', 'pio_od', 'pio_oi',
        'diagnostico', 'indicaciones', 'observaciones'].forEach((k) => { consultaNueva[k] = d[k]; });

      let receta = null;
      if ($('#c-con-receta', form).checked) {
        receta = { id: r?.id };
        Object.keys(d).filter((k) => k.startsWith('r_')).forEach((k) => { receta[k.slice(2)] = d[k]; });
      }
      await BD.guardarConsulta(consultaNueva, receta);
      aviso(consulta ? 'Consulta actualizada' : 'Consulta registrada');
      if (alGuardar) alGuardar();
    },
  });
}

function imprimirReceta(p, c, r) {
  BD.registrarAcceso('imprimir', 'recetas', p.id, { receta_id: r.id, consulta_id: c.id });
  const cfg = APP.config || {};
  const prof = c.profesionales || {};
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return aviso('El navegador bloqueó la ventana de impresión.', 'error');
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Receta</title>
    <style>
      body{font-family:Lato,Arial,sans-serif;color:#2F3A42;margin:40px;font-size:14px}
      .cab{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2196F3;padding-bottom:14px;margin-bottom:24px}
      .cab h1{margin:0;font-size:22px} .cab small{color:#6F7D88} img{max-height:60px}
      table{border-collapse:collapse;width:100%;margin:16px 0} th,td{border:1px solid #C9D2D9;padding:10px;text-align:center}
      th{background:#F6F8FA;font-size:12px} td:first-child{font-weight:700;background:#F6F8FA}
      .datos{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px} .firma{margin-top:90px;text-align:right}
      .firma div{display:inline-block;border-top:1px solid #2F3A42;padding-top:6px;min-width:260px;text-align:center}
    </style></head><body>
    <div class="cab"><div><h1>${esc(cfg.nombre_optica || 'Óptica')}</h1>
      <small>${esc([cfg.direccion, cfg.telefono, cfg.email].filter(Boolean).join(' · '))}</small></div>
      ${cfg.logo_url ? `<img src="${esc(cfg.logo_url)}" alt="">` : ''}</div>
    <h2 style="font-size:16px;margin:0 0 12px">Receta óptica · ${esc(TIPOS_RECETA[r.tipo] || r.tipo)}</h2>
    <div class="datos">
      <div><b>Paciente:</b> ${esc(p.apellido)}, ${esc(p.nombre)}</div><div><b>DNI:</b> ${esc(p.dni)}</div>
      <div><b>Fecha:</b> ${fmtFechaHora(c.fecha).slice(0, 10)}</div><div><b>Cobertura:</b> ${esc(p.obra_social || '—')} ${esc(p.nro_afiliado || '')}</div>
    </div>
    ${tablaReceta(r)}
    ${r.observaciones ? `<p><b>Observaciones:</b> ${esc(r.observaciones)}</p>` : ''}
    ${c.diagnostico ? `<p><b>Diagnóstico:</b> ${esc(c.diagnostico)}</p>` : ''}
    <div class="firma"><div>${esc(prof.apellido ? `${prof.nombre} ${prof.apellido}` : '')}<br><small>${esc(prof.matricula || '')} · ${esc(prof.especialidad || '')}</small></div></div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

// ---------------------------------------------------------------------
// 10. PROFESIONALES
// ---------------------------------------------------------------------
async function cargarProfesionales() {
  $('#btn-nuevo-profesional').classList.toggle('oculto', !esAdmin());
  APP.profesionales = await BD.listarProfesionales();
  pintarProfesionales();
}

function resumenHorarios(horarios) {
  return [...horarios].sort((a, b) => a.dia_semana - b.dia_semana || a.hora_desde.localeCompare(b.hora_desde))
    .map((h) => `${DIAS[h.dia_semana].slice(0, 3)} ${fmtHora(h.hora_desde)}–${fmtHora(h.hora_hasta)}`).join(' · ');
}

function pintarProfesionales() {
  const verInactivos = $('#prof-ver-inactivos').checked;
  const lista = APP.profesionales.filter((p) => verInactivos || p.activo);
  $('#profesionales-lista').innerHTML = lista.length ? lista.map((p) => {
    const dias = new Set(p.horarios_profesional.map((h) => h.dia_semana));
    return `
    <div class="prof-card ${p.activo ? '' : 'inactivo'}" style="border-top-color:${esc(p.color)}">
      <div class="cab">
        <div class="avatar" style="background:${esc(p.color)};width:42px;height:42px">${esc(iniciales(p.nombre, p.apellido))}</div>
        <div><h4>${esc(p.apellido)}, ${esc(p.nombre)}</h4><div class="esp">${esc(p.especialidad)}</div></div>
      </div>
      <div class="linea">${icono('etiqueta', 'icono-sm')} ${esc(p.matricula)}</div>
      <div class="linea">${icono('puerta', 'icono-sm')} Consultorio ${esc(consultorioDe(p) || '—')}${p.consultorio_fecha === hoy() && p.consultorio_hoy && p.consultorio_hoy !== p.consultorio ? ' <span class="c-violeta">(hoy)</span>' : ''}</div>
      ${p.telefono ? `<div class="linea">${icono('telefono', 'icono-sm')} ${esc(p.telefono)}</div>` : ''}
      ${p.email ? `<div class="linea">${icono('mail', 'icono-sm')} ${esc(p.email)}</div>` : ''}
      <div class="dias">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<span class="dia ${dias.has(d) ? 'on' : ''}" title="${DIAS[d]}">${DIAS[d][0]}</span>`).join('')}</div>
      <div class="ayuda">${esc(resumenHorarios(p.horarios_profesional) || 'Sin horarios cargados')}</div>
      <div class="pie">
        <span><span class="badge badge-${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
          <span class="c-suave" style="margin-left:6px">Turnos de ${p.duracion_turno} min</span></span>
        ${esAdmin() ? `<button class="btn btn-sec btn-chico" data-editar-prof="${p.id}">${icono('editar', 'icono-sm')} Editar</button>` : ''}
      </div>
    </div>`;
  }).join('') : vacio('No hay profesionales cargados.');
}

function modalProfesional(p = null) {
  const v = (k) => esc(p?.[k] ?? '');
  const filaHorario = (h = {}) => `
    <div class="fila-horario">
      <select data-h="dia_semana">${opciones([1, 2, 3, 4, 5, 6, 0].map((d) => ({ valor: d, texto: DIAS[d] })), h.dia_semana ?? 1)}</select>
      <input type="time" data-h="hora_desde" value="${fmtHora(h.hora_desde) || '09:00'}" required>
      <input type="time" data-h="hora_hasta" value="${fmtHora(h.hora_hasta) || '13:00'}" required>
      <button type="button" class="btn btn-icono peligro" data-quitar title="Quitar">${icono('borrar')}</button>
    </div>`;

  abrirModal({
    titulo: p ? 'Editar profesional' : 'Nuevo profesional', tam: 'ancho',
    cuerpo: `
      <div class="fila-3">
        <div class="campo"><label>Apellido <span class="req">*</span></label><input name="apellido" required value="${v('apellido')}"></div>
        <div class="campo"><label>Nombre <span class="req">*</span></label><input name="nombre" required value="${v('nombre')}"></div>
        <div class="campo"><label>DNI</label><input name="dni" value="${v('dni')}"></div>
      </div>
      <div class="fila-3">
        <div class="campo"><label>Matrícula <span class="req">*</span></label><input name="matricula" required value="${v('matricula')}" placeholder="MN 00000"></div>
        <div class="campo"><label>Especialidad <span class="req">*</span></label><input name="especialidad" required value="${v('especialidad')}" list="lista-esp">
          <datalist id="lista-esp"><option value="Oftalmología general"><option value="Oftalmología pediátrica"><option value="Retina y glaucoma"><option value="Contactología y optometría"><option value="Óptico técnico"></datalist></div>
        <div class="campo"><label>Duración del turno (min) <span class="req">*</span></label><input type="number" name="duracion_turno" min="5" max="240" step="5" required value="${v('duracion_turno') || 20}"></div>
      </div>
      <div class="fila-3">
        <div class="campo"><label>Teléfono</label><input name="telefono" value="${v('telefono')}"></div>
        <div class="campo"><label>Email</label><input type="email" name="email" value="${v('email')}"></div>
        <div class="campo"><label>Consultorio habitual</label><input name="consultorio" value="${v('consultorio')}" placeholder="Ej.: 1, 2, Box 3"></div>
        <div class="campo"><label>Color en la agenda</label><input type="color" name="color" value="${v('color') || '#2196F3'}" style="height:38px;padding:3px"></div>
      </div>
      <label class="check"><input type="checkbox" name="activo" ${!p || p.activo ? 'checked' : ''}> Profesional activo (aparece en la agenda)</label>
      <div class="seccion-form">Días y horarios de atención</div>
      <div class="fila-horario ayuda"><span>Día</span><span>Desde</span><span>Hasta</span><span></span></div>
      <div id="p-horarios">${(p?.horarios_profesional?.length ? [...p.horarios_profesional].sort((a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)) : [{}]).map(filaHorario).join('')}</div>
      <button type="button" class="btn btn-sec btn-chico" id="p-agregar-horario">${icono('mas', 'icono-sm')} Agregar horario</button>`,
    alAbrir: (form) => {
      $('#p-agregar-horario', form).addEventListener('click', () => $('#p-horarios', form).insertAdjacentHTML('beforeend', filaHorario()));
      $('#p-horarios', form).addEventListener('click', (e) => { if (e.target.closest('[data-quitar]')) e.target.closest('.fila-horario').remove(); });
    },
    onGuardar: async (d, form) => {
      const horarios = $$('#p-horarios .fila-horario', form).map((f) => ({
        dia_semana: Number($('[data-h=dia_semana]', f).value),
        hora_desde: $('[data-h=hora_desde]', f).value,
        hora_hasta: $('[data-h=hora_hasta]', f).value,
      }));
      if (horarios.some((h) => h.hora_hasta <= h.hora_desde)) throw new Error('En cada horario, la hora "hasta" debe ser mayor que "desde".');
      const prof = { ...d, id: p?.id, duracion_turno: Number(d.duracion_turno) };
      ['dni', 'telefono', 'email', 'consultorio'].forEach((k) => { if (!prof[k]) prof[k] = null; });
      await BD.guardarProfesional(prof, horarios);
      aviso(p ? 'Profesional actualizado' : 'Profesional registrado');
      await cargarProfesionales();
    },
  });
}

// ---------------------------------------------------------------------
// 11. PRÁCTICAS Y TARIFAS
// ---------------------------------------------------------------------
async function cargarPracticas() {
  $('#btn-nueva-practica').classList.toggle('oculto', !esAdmin());
  $('#btn-nueva-tarifa').classList.toggle('oculto', !esAdmin());
  [APP.practicas, APP.tarifas] = await Promise.all([BD.listarPracticas(), BD.listarTarifas()]);
  const filtro = $('#tarifas-filtro').value;
  $('#tarifas-filtro').innerHTML = opciones(APP.practicas.map((p) => ({ valor: p.id, texto: p.nombre })), filtro, { vacioTexto: 'Todas las prácticas' });
  pintarPracticas();
  pintarTarifas();
}

async function refrescarTarifas() {
  APP.tarifas = await BD.listarTarifas();
  pintarPracticas();
  pintarTarifas();
}

function pintarPracticas() {
  $('#practicas-tabla').innerHTML = APP.practicas.length ? `
    <table class="tabla"><thead><tr><th>Código</th><th>Práctica</th><th class="num">Duración</th><th class="num">Precio vigente</th>
      <th class="num">Tarifas propias</th><th>Estado</th><th></th></tr></thead><tbody>
    ${APP.practicas.map((p) => {
      const general = BD.precioVigente(APP.tarifas.filter((t) => t.profesional_id === null), p.id, null);
      const propias = new Set(APP.tarifas.filter((t) => t.practica_id === p.id && t.profesional_id !== null).map((t) => t.profesional_id)).size;
      return `<tr>
        <td><b>${esc(p.codigo)}</b></td>
        <td>${esc(p.nombre)}${p.descripcion ? `<span class="sub">${esc(p.descripcion)}</span>` : ''}</td>
        <td class="num">${p.duracion_min} min</td>
        <td class="num"><b>${general === null ? '<span class="c-rojo">Sin precio</span>' : dinero(general)}</b></td>
        <td class="num">${propias ? `${propias} profesional${propias > 1 ? 'es' : ''}` : '—'}</td>
        <td><span class="badge badge-${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activa' : 'Inactiva'}</span></td>
        <td><div class="acciones">${esAdmin() ? `
          <button class="btn btn-icono" data-tarifa-practica="${p.id}" title="Actualizar precio">${icono('dinero')}</button>
          <button class="btn btn-icono" data-editar-practica="${p.id}" title="Editar">${icono('editar')}</button>` : ''}</div></td>
      </tr>`;
    }).join('')}</tbody></table>` : vacio('No hay prácticas cargadas.');
}

// Clasifica cada tarifa como vigente, programada (futura) o histórica
function estadoTarifa(t) {
  const h = hoy();
  if (t.vigente_desde > h) return 'programada';
  const misma = APP.tarifas.filter((x) => x.practica_id === t.practica_id && x.profesional_id === t.profesional_id && x.vigente_desde <= h);
  const ultima = misma.sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0];
  return ultima?.id === t.id ? 'vigente' : 'historica';
}

function pintarTarifas() {
  const filtro = Number($('#tarifas-filtro').value) || null;
  const lista = APP.tarifas.filter((t) => !filtro || t.practica_id === filtro).sort((a, b) =>
    (a.practicas?.nombre || '').localeCompare(b.practicas?.nombre || '') ||
    (a.profesional_id ?? 0) - (b.profesional_id ?? 0) ||
    b.vigente_desde.localeCompare(a.vigente_desde));
  const etiqueta = { vigente: ['activo', 'Vigente'], programada: ['confirmado', 'Programada'], historica: ['inactivo', 'Histórica'] };
  $('#tarifas-tabla').innerHTML = lista.length ? `
    <table class="tabla"><thead><tr><th>Práctica</th><th>Aplica a</th><th class="num">Precio</th><th>Vigente desde</th><th>Estado</th><th></th></tr></thead><tbody>
    ${lista.map((t) => {
      const [clase, texto] = etiqueta[estadoTarifa(t)];
      return `<tr>
        <td>${esc(t.practicas?.nombre)}<span class="sub">${esc(t.practicas?.codigo)}</span></td>
        <td>${t.profesionales ? esc(nombreProf(t.profesionales)) : '<span class="badge badge-neutro">General</span>'}</td>
        <td class="num"><b>${dinero(t.precio)}</b></td>
        <td>${fmtFecha(t.vigente_desde)}</td>
        <td><span class="badge badge-${clase}">${texto}</span></td>
        <td><div class="acciones">${esAdmin() ? `<button class="btn btn-icono peligro" data-borrar-tarifa="${t.id}" title="Eliminar">${icono('borrar')}</button>` : ''}</div></td>
      </tr>`;
    }).join('')}</tbody></table>` : vacio('No hay tarifas cargadas.');
}

function modalPractica(p = null) {
  const v = (k) => esc(p?.[k] ?? '');
  abrirModal({
    titulo: p ? 'Editar práctica' : 'Nueva práctica',
    cuerpo: `
      <div class="fila-2">
        <div class="campo"><label>Código <span class="req">*</span></label><input name="codigo" required maxlength="10" value="${v('codigo')}" style="text-transform:uppercase"></div>
        <div class="campo"><label>Duración (min) <span class="req">*</span></label><input type="number" name="duracion_min" min="5" max="240" step="5" required value="${v('duracion_min') || 20}"></div>
      </div>
      <div class="campo"><label>Nombre <span class="req">*</span></label><input name="nombre" required value="${v('nombre')}"></div>
      <div class="campo"><label>Descripción</label><textarea name="descripcion" rows="2">${v('descripcion')}</textarea></div>
      ${p ? '' : `<div class="campo"><label>Precio inicial (tarifa general) <span class="req">*</span></label><input type="number" name="precio" min="0" step="100" required></div>`}
      <label class="check"><input type="checkbox" name="activo" ${!p || p.activo ? 'checked' : ''}> Práctica activa</label>`,
    onGuardar: async (d) => {
      const { precio, ...campos } = d;
      const guardada = await BD.guardarPractica({ ...campos, id: p?.id, codigo: d.codigo.toUpperCase(), duracion_min: Number(d.duracion_min), descripcion: d.descripcion || null });
      if (!p) await BD.agregarTarifa({ practica_id: guardada.id, profesional_id: null, precio: Number(precio), vigente_desde: hoy() });
      aviso(p ? 'Práctica actualizada' : 'Práctica creada');
      await cargarPracticas();
    },
  });
}

function modalTarifa(datos = {}) {
  abrirModal({
    titulo: 'Nueva tarifa', tam: 'chico', textoGuardar: 'Guardar tarifa',
    cuerpo: `
      <div class="campo"><label>Práctica <span class="req">*</span></label><select name="practica_id" required>${opcionesPracticas(datos.practica_id, 'Seleccionar…')}</select></div>
      <div class="campo"><label>Aplica a</label><select name="profesional_id">${opcionesProfesionales('', 'General (todos los profesionales)')}</select>
        <span class="ayuda">Si un profesional tiene tarifa propia, se usa esa en lugar de la general.</span></div>
      <div class="fila-2">
        <div class="campo"><label>Precio <span class="req">*</span></label><input type="number" name="precio" min="0" step="100" required></div>
        <div class="campo"><label>Vigente desde <span class="req">*</span></label><input type="date" name="vigente_desde" required value="${hoy()}"></div>
      </div>
      <div class="ayuda">Las tarifas anteriores se conservan como historial. Los turnos ya dados mantienen el precio con el que se registraron.</div>`,
    onGuardar: async (d) => {
      await BD.agregarTarifa({
        practica_id: Number(d.practica_id),
        profesional_id: d.profesional_id ? Number(d.profesional_id) : null,
        precio: Number(d.precio),
        vigente_desde: d.vigente_desde,
      });
      aviso('Tarifa registrada');
      await refrescarTarifas();
    },
  });
}

// ---------------------------------------------------------------------
// 12. REPORTES
// ---------------------------------------------------------------------
APP.reporte = null;

async function cargarReportes() {
  const sel = $('#rep-profesional');
  sel.innerHTML = opcionesProfesionales(sel.value, 'Todos los profesionales', false);
  if (!$('#rep-desde').value) aplicarPeriodoReporte();
  if (!APP.reporte) await generarReporte();
}

function aplicarPeriodoReporte() {
  const h = new Date();
  const f = BD.fechaISO;
  const p = $('#rep-periodo').value;
  let desde, hasta = f(h);
  if (p === 'mes') { desde = f(new Date(h.getFullYear(), h.getMonth(), 1)); hasta = f(new Date(h.getFullYear(), h.getMonth() + 1, 0)); }
  if (p === 'mes-ant') { desde = f(new Date(h.getFullYear(), h.getMonth() - 1, 1)); hasta = f(new Date(h.getFullYear(), h.getMonth(), 0)); }
  if (p === '30') desde = sumarDias(hasta, -29);
  if (p === '90') desde = sumarDias(hasta, -89);
  if (p === 'anio') { desde = f(new Date(h.getFullYear(), 0, 1)); hasta = f(new Date(h.getFullYear(), 11, 31)); }
  if (p === 'otro') return;
  $('#rep-desde').value = desde;
  $('#rep-hasta').value = hasta;
}

async function generarReporte() {
  const desde = $('#rep-desde').value, hasta = $('#rep-hasta').value;
  const profesionalId = $('#rep-profesional').value || null;
  if (!desde || !hasta || desde > hasta) return aviso('Revisá el rango de fechas.', 'error');
  const cont = $('#reporte-contenido');
  cont.innerHTML = cargando();
  try {
    const r = await BD.reporteGeneral({ desde, hasta, profesionalId });
    APP.reporte = { ...r, desde, hasta, profesionalId };
    pintarReporte();
  } catch (e) { cont.innerHTML = ''; avisoError(e); }
}

function pintarReporte() {
  const r = APP.reporte;
  const k = r.kpi;
  const prof = r.profesionalId ? APP.profesionales.find((p) => p.id === Number(r.profesionalId)) : null;
  $('#rep-encabezado-impresion').innerHTML = `<h2>${esc(APP.config?.nombre_optica || '')} — Reporte de gestión</h2>
    <p>Período: ${fmtFecha(r.desde)} al ${fmtFecha(r.hasta)}${prof ? ' · Profesional: ' + esc(nombreProf(prof)) : ''}</p>`;

  const kpi = (valor, texto, color = '') => `<div class="kpi"><div class="valor ${color}">${valor}</div><div class="etiqueta">${texto}</div></div>`;
  const botonCSV = (clave) => `<button class="btn btn-sec btn-chico no-imprimir" data-exportar="${clave}">${icono('descargar', 'icono-sm')} CSV</button>`;
  const sinDatos = !k.total;

  $('#reporte-contenido').innerHTML = `
    <div class="kpis kpis-reporte mb">
      ${kpi(numero(k.total), 'Turnos')}
      ${kpi(numero(k.atendidos), 'Atendidos', 'c-verde')}
      ${kpi(numero(k.ausentismo, 1) + '%', 'Ausentismo', 'c-rojo')}
      ${kpi(dinero(k.facturacion), 'Facturación', 'c-azul')}
      ${kpi(dinero(k.ticketPromedio), 'Ticket promedio')}
      ${kpi(numero(k.pacientesAtendidos), 'Pacientes atendidos')}
      ${kpi(numero(k.pacientesNuevos), 'Pacientes nuevos', 'c-ambar')}
      ${kpi(numero(k.whatsapp), 'Pedidos por WhatsApp')}
    </div>
    ${sinDatos ? `<div class="tarjeta">${vacio('No hay turnos en el período seleccionado.')}</div>` : `
    <div class="grilla g-2-1 mb">
      <div class="tarjeta"><div class="tarjeta-cab"><h3>Turnos por día</h3></div>
        <div class="tarjeta-cuerpo"><div class="grafico"><canvas id="graf-dias"></canvas></div></div></div>
      <div class="tarjeta"><div class="tarjeta-cab"><h3>Turnos por estado</h3></div>
        <div class="tarjeta-cuerpo"><div class="grafico"><canvas id="graf-estados"></canvas></div></div></div>
    </div>
    <div class="grilla g-2 mb">
      <div class="tarjeta"><div class="tarjeta-cab"><h3>Facturación por profesional</h3></div>
        <div class="tarjeta-cuerpo"><div class="grafico"><canvas id="graf-prof"></canvas></div></div></div>
      <div class="tarjeta"><div class="tarjeta-cab"><h3>Prácticas realizadas</h3></div>
        <div class="tarjeta-cuerpo"><div class="grafico"><canvas id="graf-practicas"></canvas></div></div></div>
    </div>

    <div class="tarjeta">
      <div class="tarjeta-cab"><h3>Detalle por profesional</h3><div class="espacio"></div>${botonCSV('profesionales')}</div>
      <div class="tarjeta-cuerpo sin-padding tabla-wrap"><table class="tabla"><thead><tr>
        <th>Profesional</th><th class="num">Turnos</th><th class="num">Atendidos</th><th class="num">Ausentes</th>
        <th class="num">Cancelados</th><th class="num">Pendientes</th><th class="num">Ausentismo</th><th class="num">Facturación</th></tr></thead><tbody>
        ${r.porProfesional.map((p) => `<tr>
          <td><span class="barra-color" style="background:${esc(p.color)}"></span>${esc(p.nombre)}</td>
          <td class="num">${p.total}</td><td class="num">${p.atendidos}</td><td class="num">${p.ausentes}</td>
          <td class="num">${p.cancelados}</td><td class="num">${p.pendientes}</td>
          <td class="num">${numero(p.ausentismo, 1)}%</td><td class="num"><b>${dinero(p.facturacion)}</b></td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total</td><td class="num">${k.total}</td><td class="num">${k.atendidos}</td><td class="num">${k.ausentes}</td>
        <td class="num">${k.cancelados}</td><td class="num">${k.pendientes}</td><td class="num">${numero(k.ausentismo, 1)}%</td>
        <td class="num">${dinero(k.facturacion)}</td></tr></tfoot></table></div>
    </div>

    <div class="grilla g-2">
      <div class="tarjeta">
        <div class="tarjeta-cab"><h3>Detalle por práctica</h3><div class="espacio"></div>${botonCSV('practicas')}</div>
        <div class="tarjeta-cuerpo sin-padding tabla-wrap"><table class="tabla"><thead><tr>
          <th>Práctica</th><th class="num">Cantidad</th><th class="num">Facturación</th><th class="num">% del total</th></tr></thead><tbody>
          ${r.porPractica.map((p) => `<tr><td>${esc(p.nombre)}</td><td class="num">${p.cantidad}</td>
            <td class="num">${dinero(p.facturacion)}</td><td class="num">${numero(k.facturacion ? (p.facturacion / k.facturacion) * 100 : 0, 1)}%</td></tr>`).join('')}
        </tbody></table></div>
      </div>
      <div class="tarjeta">
        <div class="tarjeta-cab"><h3>Atenciones por cobertura</h3><div class="espacio"></div>${botonCSV('obras')}</div>
        <div class="tarjeta-cuerpo sin-padding tabla-wrap"><table class="tabla"><thead><tr>
          <th>Obra social</th><th class="num">Atenciones</th><th class="num">Facturación</th></tr></thead><tbody>
          ${r.porObraSocial.map((o) => `<tr><td>${esc(o.nombre)}</td><td class="num">${o.cantidad}</td><td class="num">${dinero(o.facturacion)}</td></tr>`).join('')}
        </tbody></table></div>
      </div>
    </div>
    <div class="no-imprimir" style="margin-top:4px">${botonCSV('turnos').replace('CSV', 'Exportar listado completo de turnos (CSV)')}</div>`}`;

  if (sinDatos) return;

  // --- gráficos ---
  const etiquetasDias = r.porDia.map((d) => fmtFecha(d.fecha).slice(0, 5));
  const largo = r.porDia.length > 120;
  grafico('graf-dias', {
    type: 'bar',
    data: {
      labels: etiquetasDias,
      datasets: [
        { label: 'Atendidos', data: r.porDia.map((d) => d.atendidos), backgroundColor: COLOR.verde, borderRadius: 2, stack: 's' },
        { label: 'Resto (pend./ausentes)', data: r.porDia.map((d) => d.total - d.atendidos), backgroundColor: '#C9D7E3', borderRadius: 2, stack: 's' },
      ],
    },
    options: {
      maintainAspectRatio: false,
      scales: { x: { stacked: true, grid: { display: false }, ticks: { maxTicksLimit: largo ? 12 : 16 } },
                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#EEF1F4' } } },
      plugins: { legend: { position: 'bottom' } },
    },
  });

  const est = Object.keys(ESTADOS).filter((e) => r.porEstado[e]);
  grafico('graf-estados', {
    type: 'doughnut',
    data: {
      labels: est.map((e) => ESTADOS[e].texto),
      datasets: [{ data: est.map((e) => r.porEstado[e]),
        backgroundColor: est.map((e) => ({ pendiente: COLOR.ambar, confirmado: COLOR.azul, en_espera: COLOR.violeta, atendido: COLOR.verde, ausente: COLOR.rojo, cancelado: '#B8C2CC' }[e])),
        borderWidth: 2, borderColor: '#fff' }],
    },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom' } } },
  });

  const barrasH = (id, etiquetas, valores, colores, esDinero) => grafico(id, {
    type: 'bar',
    data: { labels: etiquetas, datasets: [{ data: valores, backgroundColor: colores, borderRadius: 3, barThickness: 18 }] },
    options: {
      indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => esDinero ? dinero(c.raw) : `${c.raw} atenciones` } } },
      scales: { x: { beginAtZero: true, grid: { color: '#EEF1F4' }, ticks: { callback: (v) => esDinero ? '$' + numero(v / 1000) + 'k' : v, precision: 0 } },
                y: { grid: { display: false } } },
    },
  });
  barrasH('graf-prof', r.porProfesional.map((p) => p.nombre), r.porProfesional.map((p) => p.facturacion), r.porProfesional.map((p) => p.color), true);
  barrasH('graf-practicas', r.porPractica.map((p) => p.nombre), r.porPractica.map((p) => p.cantidad), COLOR.azul, false);
}

function exportarReporte(clave) {
  const r = APP.reporte;
  const sufijo = `${r.desde}_a_${r.hasta}.csv`;
  if (clave === 'profesionales') exportarCSV(`reporte_profesionales_${sufijo}`,
    ['Profesional', 'Turnos', 'Atendidos', 'Ausentes', 'Cancelados', 'Pendientes', 'Ausentismo %', 'Facturación'],
    r.porProfesional.map((p) => [p.nombre, p.total, p.atendidos, p.ausentes, p.cancelados, p.pendientes, Number(p.ausentismo.toFixed(1)), p.facturacion]));
  if (clave === 'practicas') exportarCSV(`reporte_practicas_${sufijo}`, ['Práctica', 'Cantidad', 'Facturación'],
    r.porPractica.map((p) => [p.nombre, p.cantidad, p.facturacion]));
  if (clave === 'obras') exportarCSV(`reporte_coberturas_${sufijo}`, ['Obra social', 'Atenciones', 'Facturación'],
    r.porObraSocial.map((o) => [o.nombre, o.cantidad, o.facturacion]));
  if (clave === 'turnos') exportarCSV(`turnos_${sufijo}`,
    ['Fecha', 'Hora', 'Paciente', 'DNI', 'Obra social', 'Profesional', 'Práctica', 'Estado', 'Origen', 'Precio'],
    r.turnos.map((t) => [fmtFecha(t.fecha), fmtHora(t.hora), t.paciente, t.paciente_dni, t.paciente_obra_social || '', t.profesional,
      t.practica, ESTADOS[t.estado].texto, t.origen === 'whatsapp' ? 'WhatsApp' : 'Sistema', Number(t.precio || 0)]));
}

// ---------------------------------------------------------------------
// 13. USUARIOS
// ---------------------------------------------------------------------
async function cargarUsuarios() {
  $('#usuarios-tabla').innerHTML = cargando();
  const usuarios = await BD.listarUsuarios();
  APP.usuarios = usuarios;
  $('#usuarios-tabla').innerHTML = `
    <table class="tabla"><thead><tr><th>Usuario</th><th>Rol</th><th>Profesional vinculado</th><th>Estado</th><th>Confidencialidad</th><th>Alta</th><th></th></tr></thead><tbody>
    ${usuarios.map((u) => `<tr>
      <td><div style="display:flex;gap:10px;align-items:center">
        <div class="avatar" style="width:30px;height:30px;font-size:11px">${esc(iniciales(u.nombre || u.email, u.apellido))}</div>
        <div><b>${esc(`${u.nombre} ${u.apellido}`.trim() || '—')}</b>${u.id === APP.perfil.id ? ' <span class="c-suave">(vos)</span>' : ''}
        <span class="sub">${esc(u.email)}</span></div></div></td>
      <td>${badgeRol(u.rol)}</td>
      <td>${u.profesionales ? esc(nombreProf(u.profesionales)) : '<span class="c-suave">—</span>'}</td>
      <td><span class="badge badge-${u.activo ? 'activo' : 'inactivo'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>${u.confidencialidad_aceptada_at ? `<span class="c-verde">Aceptó el ${fmtFecha(u.confidencialidad_aceptada_at)}</span>` : '<span class="c-suave">Pendiente (se pide al ingresar)</span>'}</td>
      <td>${fmtFecha(u.created_at)}</td>
      <td><div class="acciones">
        <button class="btn btn-icono" data-accion="editar" data-id="${u.id}" title="Editar">${icono('editar')}</button>
        <button class="btn btn-icono" data-accion="password" data-id="${u.id}" title="Cambiar contraseña">${icono('llave')}</button>
      </div></td></tr>`).join('')}
    </tbody></table>`;
}

function camposUsuario(u = {}) {
  return `
    <div class="fila-2">
      <div class="campo"><label>Nombre <span class="req">*</span></label><input name="nombre" required value="${esc(u.nombre || '')}"></div>
      <div class="campo"><label>Apellido <span class="req">*</span></label><input name="apellido" required value="${esc(u.apellido || '')}"></div>
    </div>
    <div class="fila-2">
      <div class="campo"><label>Rol <span class="req">*</span></label>
        <select name="rol" required ${u.id === APP.perfil.id ? 'disabled' : ''}>${opciones(Object.entries(ROLES).map(([k, t]) => ({ valor: k, texto: t })), u.rol || 'recepcion')}</select></div>
      <div class="campo" id="u-campo-prof"><label>Profesional vinculado <span class="req">*</span></label>
        <select name="profesional_id">${opcionesProfesionales(u.profesional_id, 'Seleccionar…', false)}</select></div>
    </div>`;
}
function enlazarRolUsuario(form) {
  const actualizar = () => {
    const esMedico = $('[name=rol]', form).value === 'medico';
    $('#u-campo-prof', form).classList.toggle('oculto', !esMedico);
    $('[name=profesional_id]', form).required = esMedico;
  };
  $('[name=rol]', form).addEventListener('change', actualizar);
  actualizar();
}

function modalNuevoUsuario() {
  abrirModal({
    titulo: 'Nuevo usuario', textoGuardar: 'Crear usuario',
    cuerpo: `
      ${camposUsuario()}
      <div class="campo"><label>Email <span class="req">*</span></label><input type="email" name="email" required autocomplete="off"></div>
      <div class="fila-2">
        <div class="campo"><label>Contraseña <span class="req">*</span></label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>
        <div class="campo"><label>Repetir contraseña <span class="req">*</span></label><input type="password" name="password2" required minlength="8" autocomplete="new-password"></div>
      </div>
      <div class="ayuda">El usuario podrá ingresar inmediatamente con este email y contraseña.</div>`,
    alAbrir: enlazarRolUsuario,
    onGuardar: async (d) => {
      if (d.password !== d.password2) throw new Error('Las contraseñas no coinciden.');
      await BD.crearUsuario({ ...d, profesional_id: d.rol === 'medico' ? Number(d.profesional_id) : null });
      aviso('Usuario creado');
      cargarUsuarios();
    },
  });
}

async function accionUsuario(e) {
  const b = e.target.closest('[data-accion]');
  if (!b) return;
  const u = APP.usuarios.find((x) => x.id === b.dataset.id);
  if (b.dataset.accion === 'editar') {
    abrirModal({
      titulo: `Editar usuario · ${u.email}`,
      cuerpo: `${camposUsuario(u)}
        <label class="check"><input type="checkbox" name="activo" ${u.activo ? 'checked' : ''} ${u.id === APP.perfil.id ? 'disabled' : ''}> Usuario activo (puede ingresar al sistema)</label>`,
      alAbrir: enlazarRolUsuario,
      onGuardar: async (d, form) => {
        const rolNuevo = $('[name=rol]', form).value;
        await BD.actualizarUsuario(u.id, {
          nombre: d.nombre, apellido: d.apellido, rol: rolNuevo,
          profesional_id: rolNuevo === 'medico' ? Number(d.profesional_id) : null,
          activo: u.id === APP.perfil.id ? true : d.activo,
        });
        aviso('Usuario actualizado');
        cargarUsuarios();
      },
    });
  }
  if (b.dataset.accion === 'password') {
    abrirModal({
      titulo: `Cambiar contraseña · ${u.email}`, tam: 'chico',
      cuerpo: `
        <div class="campo"><label>Nueva contraseña</label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>
        <div class="campo"><label>Repetir contraseña</label><input type="password" name="password2" required minlength="8" autocomplete="new-password"></div>`,
      onGuardar: async (d) => {
        if (d.password !== d.password2) throw new Error('Las contraseñas no coinciden.');
        await BD.cambiarPasswordUsuario(u.id, d.password);
        aviso('Contraseña actualizada');
      },
    });
  }
}

function modalMiPassword() {
  abrirModal({
    titulo: 'Cambiar mi contraseña', tam: 'chico',
    cuerpo: `
      <div class="campo"><label>Nueva contraseña</label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>
      <div class="campo"><label>Repetir contraseña</label><input type="password" name="password2" required minlength="8" autocomplete="new-password"></div>`,
    onGuardar: async (d) => {
      if (d.password !== d.password2) throw new Error('Las contraseñas no coinciden.');
      await BD.cambiarMiPassword(d.password);
      aviso('Tu contraseña fue actualizada');
    },
  });
}

// ---------------------------------------------------------------------
// 14. CONFIGURACIÓN
// ---------------------------------------------------------------------
async function cargarConfiguracion() {
  APP.config = await BD.obtenerConfiguracion();
  const form = $('#form-config');
  ['nombre_optica', 'razon_social', 'cuit', 'direccion', 'telefono', 'email', 'logo_url'].forEach((k) => {
    form.elements[k].value = APP.config?.[k] || '';
  });
  previsualizarLogo(APP.config?.logo_url);
}

function previsualizarLogo(url) {
  const img = $('#config-logo-preview');
  img.classList.toggle('oculto', !url);
  if (url) img.src = url;
}

async function guardarConfiguracion(e) {
  e.preventDefault();
  const d = datosForm(e.target);
  for (const k in d) if (d[k] === '') d[k] = null;
  try {
    APP.config = await BD.guardarConfiguracion(d);
    aplicarMarca();
    aviso('Configuración guardada');
  } catch (err) { avisoError(err); }
}

// ---------------------------------------------------------------------
// 15. CONSULTORIO DEL DÍA
// ---------------------------------------------------------------------
// Consultorio en el que atiende hoy un profesional (el del día o el habitual)
function consultorioDe(p) {
  if (!p) return '';
  return (p.consultorio_fecha === hoy() && p.consultorio_hoy) ? p.consultorio_hoy : (p.consultorio || '');
}

function pintarChipConsultorio() {
  const chip = $('#chip-consultorio');
  const p = APP.perfil;
  const visible = p?.rol === 'medico' && p.profesional_id;
  chip.classList.toggle('oculto', !visible);
  if (visible) {
    const c = p.profesionales?.consultorio_fecha === hoy() ? p.profesionales.consultorio_hoy : null;
    chip.innerHTML = `${icono('puerta', 'icono-sm')} ${c ? 'Consultorio <b>' + esc(c) + '</b>' : 'Elegir consultorio'}`;
  }
}

function modalConsultorio(despues) {
  const pr = APP.perfil?.profesionales;
  if (!pr) return aviso('Tu usuario no está vinculado a un profesional.', 'error');
  abrirModal({
    titulo: '¿En qué consultorio atendés hoy?', tam: 'chico', textoGuardar: 'Confirmar',
    cuerpo: `
      <p style="margin:0 0 14px;color:var(--texto-suave);line-height:1.5">Es el consultorio que se anuncia en la pantalla de la sala cuando llamás a un paciente.</p>
      <div class="campo"><label>Consultorio <span class="req">*</span></label>
        <input name="consultorio" required maxlength="20" value="${esc(consultorioDe(pr))}" placeholder="Ej.: 2" style="font-size:20px;font-weight:700"></div>`,
    onGuardar: async (d) => {
      await BD.definirConsultorio(d.consultorio);
      APP.perfil = await BD.perfilActual();
      pintarChipConsultorio();
      aviso(`Hoy atendés en el consultorio ${d.consultorio}`);
      if (despues) setTimeout(despues, 50);
    },
  });
}

function abrirLlamador() {
  const w = window.open('llamador.html', 'llamador', 'width=1280,height=760');
  if (!w) aviso('El navegador bloqueó la ventana. Permití ventanas emergentes para este sitio.', 'error');
  else w.focus();
}

// ---------------------------------------------------------------------
// 16. PANTALLA DEL LLAMADOR (llamador.html)
//     Muestra el último paciente llamado y lo anuncia con un aviso
//     sonoro y voz. Recibe los llamados en tiempo real.
// ---------------------------------------------------------------------
const LLAMADOR = {
  ultimoId: 0,
  vistos: new Set(),
  cola: [],
  ocupado: false,
  historial: [],
  sonido: false,       // esta pantalla habla o solo muestra
  audio: null,         // AudioContext para el aviso sonoro
  voz: null,
  REPETICIONES: 2,     // cuántas veces se anuncia cada llamado
};

function leerPreferencia(clave) { try { return localStorage.getItem(clave); } catch { return null; } }
function guardarPreferencia(clave, valor) { try { localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } }

async function iniciarLlamador() {
  $('#ll-sonido').addEventListener('click', () => alternarSonido());
  $('#ll-pantalla').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
  });
  $('#ll-pantalla').innerHTML = `${icono('expandir')} Pantalla completa`;
  actualizarReloj(); setInterval(actualizarReloj, 1000);

  APP.config = await BD.obtenerConfiguracion();
  aplicarMarcaLlamador();

  const sesion = await verificarSesionDeNavegador();
  supabaseClient.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT') mostrarAvisoLlamador(`<h2>La sesión se cerró</h2>
      <p>Ingresá nuevamente al sistema en esta computadora y volvé a abrir el llamador.</p>
      <a class="btn" href="index.html">Ir al sistema</a>`);
  });
  if (!sesion) {
    return mostrarAvisoLlamador(`
      <h2>Iniciá sesión primero</h2>
      <p>Para usar el llamador, ingresá al sistema en esta computadora y volvé a abrir esta pantalla.</p>
      <a class="btn" href="index.html">Ir al sistema</a>`);
  }

  // voces disponibles (se cargan de forma asíncrona en algunos navegadores)
  if ('speechSynthesis' in window) {
    elegirVoz();
    speechSynthesis.onvoiceschanged = elegirVoz;
  }

  // ¿esta pantalla habla? (se pregunta la primera vez y se recuerda)
  const pref = leerPreferencia('llamador-sonido');
  if (pref === null) {
    mostrarAvisoLlamador(`
      <h2>¿Cómo se va a usar esta pantalla?</h2>
      <p>Elegí “Con voz” en la TV de la sala de espera. En las computadoras de recepción y consultorios conviene “Solo mostrar”.</p>
      <div class="ll-opciones">
        <button class="btn" data-sonido="si">${icono('llamar')} Con voz (sala de espera)</button>
        <button class="btn btn-sec" data-sonido="no">${icono('mudo')} Solo mostrar</button>
      </div>`);
    $('#ll-overlay').addEventListener('click', (e) => {
      const b = e.target.closest('[data-sonido]');
      if (!b) return;
      guardarPreferencia('llamador-sonido', b.dataset.sonido);
      configurarSonido(b.dataset.sonido === 'si');
      ocultarAvisoLlamador();
    });
  } else if (pref === 'si') {
    // los navegadores exigen un toque antes de reproducir sonido
    mostrarAvisoLlamador(`<h2>${icono('llamar')} Tocá la pantalla para activar el sonido</h2>
      <p>Es un requisito del navegador. Solo hace falta una vez cada vez que se abre el llamador.</p>`, true);
    $('#ll-overlay').addEventListener('click', () => { configurarSonido(true); ocultarAvisoLlamador(); }, { once: true });
  } else {
    configurarSonido(false);
  }

  // pantalla siempre encendida (si el navegador lo permite)
  try { await navigator.wakeLock?.request('screen'); } catch { /* opcional */ }

  // llamados anteriores de hoy (se muestran sin anunciarlos)
  try {
    const previos = await BD.llamadosDeHoy({ limite: 7 });
    previos.reverse().forEach((ll) => { LLAMADOR.vistos.add(ll.id); LLAMADOR.ultimoId = Math.max(LLAMADOR.ultimoId, ll.id); mostrarLlamado(ll, false); });
  } catch (e) { console.error(e); }

  // tiempo real + consulta periódica como respaldo
  try {
    supabaseClient.realtime.setAuth(sesion.access_token);
    BD.escucharLlamados(recibirLlamado);
  } catch (e) { console.warn('Realtime no disponible', e); }
  setInterval(buscarLlamadosNuevos, 4000);

  // la pantalla de la sala (con voz) cuenta como uso activo: evita que se cierre la sesión por inactividad
  setInterval(() => { if (LLAMADOR.sonido) registrarActividad(true); }, 60000);
}

function aplicarMarcaLlamador() {
  const nombre = APP.config?.nombre_optica || 'Mi Óptica';
  $$('.js-nombre-optica').forEach((el) => { el.textContent = nombre; });
  document.title = `Llamador · ${nombre}`;
  const logo = APP.config?.logo_url;
  $('#ll-logo').classList.toggle('oculto', !logo);
  $('#ll-icono').classList.toggle('oculto', !!logo);
  if (logo) $('#ll-logo').src = logo;
}

function actualizarReloj() {
  const ahora = new Date();
  $('#ll-hora').textContent = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const f = ahora.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#ll-fecha').textContent = f[0].toUpperCase() + f.slice(1);
}

function mostrarAvisoLlamador(html, clicEnTodo = false) {
  const o = $('#ll-overlay');
  o.innerHTML = `<div class="ll-aviso">${html}</div>`;
  o.classList.remove('oculto');
  o.classList.toggle('clic', clicEnTodo);
}
function ocultarAvisoLlamador() { $('#ll-overlay').classList.add('oculto'); }

function configurarSonido(activo) {
  LLAMADOR.sonido = activo;
  if (activo) {
    try {
      LLAMADOR.audio ||= new (window.AudioContext || window.webkitAudioContext)();
      LLAMADOR.audio.resume();
      // "desbloquea" la voz en navegadores que lo requieren
      if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    } catch { /* sin audio */ }
  }
  $('#ll-sonido').innerHTML = activo ? `${icono('llamar')} Sonido activado` : `${icono('mudo')} Sin sonido`;
  $('#ll-sonido').classList.toggle('apagado', !activo);
}

function alternarSonido() {
  const activo = !LLAMADOR.sonido;
  guardarPreferencia('llamador-sonido', activo ? 'si' : 'no');
  configurarSonido(activo);
  if (activo) anunciar({ paciente: 'Prueba de sonido', consultorio: '1' }, 1);
}

function elegirVoz() {
  const voces = speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('es'));
  const preferidas = ['es-ar', 'es-419', 'es-us', 'es-mx', 'es-es'];
  voces.sort((a, b) => {
    const ia = preferidas.indexOf(a.lang.toLowerCase()), ib = preferidas.indexOf(b.lang.toLowerCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (b.localService === false) - (a.localService === false);
  });
  LLAMADOR.voz = voces[0] || null;
}

function recibirLlamado(ll) {
  if (!ll || LLAMADOR.vistos.has(ll.id)) return;
  // solo llamados de hoy
  if (new Date(ll.created_at).toDateString() !== new Date().toDateString()) return;
  LLAMADOR.vistos.add(ll.id);
  LLAMADOR.ultimoId = Math.max(LLAMADOR.ultimoId, ll.id);
  LLAMADOR.cola.push(ll);
  procesarCola();
}

async function buscarLlamadosNuevos() {
  try {
    const nuevos = await BD.llamadosDeHoy({ desdeId: LLAMADOR.ultimoId, limite: 20 });
    nuevos.reverse().forEach(recibirLlamado);
  } catch { /* se reintenta en el próximo ciclo */ }
}

// Muestra y anuncia los llamados de a uno, en orden
async function procesarCola() {
  if (LLAMADOR.ocupado) return;
  const ll = LLAMADOR.cola.shift();
  if (!ll) return;
  LLAMADOR.ocupado = true;
  mostrarLlamado(ll, true);
  const inicio = Date.now();
  if (LLAMADOR.sonido) {
    await sonarAviso();
    await anunciar(ll, LLAMADOR.REPETICIONES);
  }
  // cada llamado queda en pantalla al menos 6 segundos antes del siguiente
  await new Promise((r) => setTimeout(r, Math.max(0, 6000 - (Date.now() - inicio))));
  LLAMADOR.ocupado = false;
  procesarCola();
}

function mostrarLlamado(ll, destacar) {
  LLAMADOR.historial.unshift(ll);
  LLAMADOR.historial = LLAMADOR.historial.slice(0, 7);

  $('#ll-vacio').classList.add('oculto');
  $('#ll-contenido').classList.remove('oculto');
  $('#ll-paciente').textContent = ll.paciente;
  $('#ll-consultorio').textContent = ll.consultorio;
  $('#ll-profesional').textContent = ll.profesional ? `Profesional: ${ll.profesional}` : '';

  const hm = (ts) => new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const anteriores = LLAMADOR.historial.slice(1);
  $('#ll-lista').innerHTML = anteriores.length
    ? anteriores.map((x) => `<li><div><b>${esc(x.paciente)}</b><span>${hm(x.created_at)}</span></div><em>Cons. ${esc(x.consultorio)}</em></li>`).join('')
    : '<li class="ll-sin">Todavía no hay otros llamados.</li>';

  if (destacar) {
    const caja = $('#ll-actual');
    caja.classList.remove('ll-nuevo'); void caja.offsetWidth; caja.classList.add('ll-nuevo');
  }
}

// Aviso sonoro "ding-dong" generado con Web Audio (no necesita archivos)
function sonarAviso() {
  return new Promise((resolver) => {
    const ctx = LLAMADOR.audio;
    if (!ctx) return resolver();
    const tono = (frecuencia, comienzo, duracion) => {
      const osc = ctx.createOscillator(), gan = ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = frecuencia;
      gan.gain.setValueAtTime(0.0001, ctx.currentTime + comienzo);
      gan.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + comienzo + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + comienzo + duracion);
      osc.connect(gan).connect(ctx.destination);
      osc.start(ctx.currentTime + comienzo); osc.stop(ctx.currentTime + comienzo + duracion);
    };
    tono(659.25, 0, 0.9);    // Mi
    tono(523.25, 0.45, 1.2); // Do
    setTimeout(resolver, 1500);
  });
}

// Anuncia por voz: "Juan Pérez, presentarse en consultorio 2."
function anunciar(ll, veces = 1) {
  return new Promise((resolver) => {
    if (!('speechSynthesis' in window)) return resolver();
    speechSynthesis.cancel();
    let pendientes = veces;
    const fin = () => { if (--pendientes <= 0) resolver(); };
    for (let i = 0; i < veces; i++) {
      const u = new SpeechSynthesisUtterance(`${ll.paciente}, presentarse en consultorio ${ll.consultorio}.`);
      u.lang = LLAMADOR.voz?.lang || 'es-AR';
      if (LLAMADOR.voz) u.voice = LLAMADOR.voz;
      u.rate = 0.9;
      u.onend = fin; u.onerror = fin;
      speechSynthesis.speak(u);
    }
    setTimeout(resolver, 15000); // por si el navegador no avisa el final
  });
}

// ---------------------------------------------------------------------
// 17. SEGURIDAD DE LA SESIÓN
//     - La sesión termina al cerrar el navegador (cookie de sesión).
//     - Se cierra sola tras un tiempo sin uso, con aviso previo.
//     - Al salir se borra todo y la página se recarga limpia.
// ---------------------------------------------------------------------
const SEGURIDAD = {
  MINUTOS_INACTIVIDAD: 20,          // cierre automático tras este tiempo sin uso
  SEGUNDOS_AVISO: 60,               // aviso antes del cierre
  COOKIE: 'optica_sesion',          // marca que vive solo mientras el navegador está abierto
  CLAVE_ACTIVIDAD: 'optica-actividad',
  ultimaActividad: Date.now(),
  ultimaEscritura: 0,
};

const esArchivoLocal = () => location.protocol === 'file:';

// La cookie sin fecha de vencimiento se borra al cerrar el navegador
function marcarSesionNavegador() {
  if (esArchivoLocal()) return;
  document.cookie = `${SEGURIDAD.COOKIE}=1; path=/; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
}
function borrarMarcaSesion() {
  document.cookie = `${SEGURIDAD.COOKIE}=; path=/; max-age=0; SameSite=Strict`;
}
function navegadorConSesion() {
  if (esArchivoLocal()) return true;   // abierto con doble clic: las cookies no funcionan en file://
  return document.cookie.split(';').some((c) => c.trim().startsWith(SEGURIDAD.COOKIE + '='));
}

// Si hay una sesión guardada pero el navegador se cerró desde entonces, se descarta
async function verificarSesionDeNavegador() {
  const sesion = await BD.sesionActual();
  if (sesion && !navegadorConSesion()) {
    await BD.logout();
    return null;
  }
  return sesion;
}

// La última actividad se comparte entre pestañas (usar el sistema en una mantiene viva la otra)
function registrarActividad(forzar = false) {
  const ahora = Date.now();
  SEGURIDAD.ultimaActividad = ahora;
  if (forzar || ahora - SEGURIDAD.ultimaEscritura > 10000) {
    SEGURIDAD.ultimaEscritura = ahora;
    try { localStorage.setItem(SEGURIDAD.CLAVE_ACTIVIDAD, String(ahora)); } catch { /* sin almacenamiento */ }
  }
}
function ultimaActividad() {
  let guardada = 0;
  try { guardada = Number(localStorage.getItem(SEGURIDAD.CLAVE_ACTIVIDAD)) || 0; } catch { /* nada */ }
  return Math.max(SEGURIDAD.ultimaActividad, guardada);
}
function inactivoDemasiado() {
  let guardada = 0;
  try { guardada = Number(localStorage.getItem(SEGURIDAD.CLAVE_ACTIVIDAD)) || 0; } catch { /* nada */ }
  return guardada > 0 && Date.now() - guardada > SEGURIDAD.MINUTOS_INACTIVIDAD * 60000;
}

function iniciarControlInactividad() {
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) =>
    document.addEventListener(ev, () => registrarActividad(), { passive: true, capture: true }));
  setInterval(revisarInactividad, 5000);
}

function revisarInactividad() {
  if (!APP.perfil) return;
  const limite = SEGURIDAD.MINUTOS_INACTIVIDAD * 60000;
  const restante = limite - (Date.now() - ultimaActividad());
  if (restante <= 0) return cerrarSesion('inactividad');
  let aviso = $('#aviso-inactividad');
  if (restante <= SEGURIDAD.SEGUNDOS_AVISO * 1000) {
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.id = 'aviso-inactividad';
      aviso.className = 'aviso-inactividad';
      document.body.appendChild(aviso);
    }
    aviso.innerHTML = `${icono('reloj')} <span>Por seguridad, tu sesión se cerrará en <b>${Math.ceil(restante / 1000)} s</b> por inactividad.</span>
      <button class="btn btn-chico" type="button">Seguir trabajando</button>`;
  } else if (aviso) {
    aviso.remove();
  }
}

// Cierra la sesión, borra lo guardado en el navegador y recarga la página limpia
async function cerrarSesion(motivo) {
  APP.perfil = null;
  await BD.logout();
  borrarMarcaSesion();
  try { localStorage.removeItem(SEGURIDAD.CLAVE_ACTIVIDAD); sessionStorage.clear(); } catch { /* nada */ }
  location.replace(location.pathname + (motivo ? `?motivo=${motivo}` : ''));
}

// ---------------------------------------------------------------------
// 18. AUDITORÍA (solo administradores)
// ---------------------------------------------------------------------
APP.auditoria = { pagina: 0, porPagina: 50, filas: [] };

const TABLAS_AUDITORIA = {
  pacientes: 'Paciente', consultas: 'Historia clínica', recetas: 'Receta', turnos: 'Turno',
  tarifas: 'Tarifa', profesionales: 'Profesional', practicas: 'Práctica', perfiles: 'Usuario',
  configuracion: 'Configuración', reportes: 'Reportes', auditoria: 'Auditoría',
};
const ACCIONES_AUDITORIA = {
  crear: ['Creó', 'activo'], modificar: ['Modificó', 'confirmado'], eliminar: ['Eliminó', 'ausente'],
  ver: ['Consultó', 'neutro'], imprimir: ['Imprimió', 'pendiente'], exportar: ['Exportó', 'en_espera'],
};
const CAMPOS_RESUMEN = ['apellido', 'nombre', 'dni', 'fecha', 'hora', 'estado', 'motivo', 'diagnostico',
  'precio', 'vigente_desde', 'email', 'rol', 'codigo', 'tipo', 'archivo', 'filas', 'consultas'];

const textoCampo = (k) => k.replace(/_/g, ' ');
function valorAuditoria(v) {
  if (v === null || v === undefined || v === '') return '—';
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return t.length > 40 ? t.slice(0, 40) + '…' : t;
}

// Resumen legible de lo que cambió
function resumenAuditoria(f) {
  const d = f.detalle || {};
  if (f.accion === 'modificar') {
    const cambios = Object.entries(d);
    const txt = cambios.slice(0, 3).map(([k, [a, b]]) =>
      `<b>${esc(textoCampo(k))}</b>: ${esc(valorAuditoria(a))} → ${esc(valorAuditoria(b))}`).join('<br>');
    return txt + (cambios.length > 3 ? `<br><span class="c-suave">y ${cambios.length - 3} cambio(s) más</span>` : '');
  }
  const partes = CAMPOS_RESUMEN.filter((k) => d[k] !== undefined && d[k] !== null && d[k] !== '')
    .slice(0, 4).map((k) => `${esc(textoCampo(k))}: ${esc(valorAuditoria(d[k]))}`);
  return partes.join(' · ') || '<span class="c-suave">—</span>';
}

function tablaAuditoria(filas, { conPaciente = true } = {}) {
  if (!filas.length) return vacio('No hay registros para los filtros elegidos.');
  return `<table class="tabla tabla-auditoria"><thead><tr>
      <th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Sobre</th>${conPaciente ? '<th>Paciente</th>' : ''}<th>Detalle</th><th></th>
    </tr></thead><tbody>
    ${filas.map((f) => {
      const [texto, clase] = ACCIONES_AUDITORIA[f.accion] || [f.accion, 'neutro'];
      return `<tr>
        <td class="nowrap">${fmtFechaHora(f.created_at)}</td>
        <td>${f.usuario_email ? esc(f.usuario_email) : '<span class="c-suave">Sistema</span>'}
            ${f.usuario_rol ? `<span class="sub">${esc(ROLES[f.usuario_rol] || f.usuario_rol)}${f.ip ? ' · ' + esc(f.ip) : ''}</span>` : ''}</td>
        <td><span class="badge badge-${clase}">${esc(texto)}</span></td>
        <td class="nowrap">${esc(TABLAS_AUDITORIA[f.tabla] || f.tabla)}${f.registro_id && f.registro_id.length < 12 ? ` <span class="c-suave">#${esc(f.registro_id)}</span>` : ''}</td>
        ${conPaciente ? `<td>${f.paciente_id ? `<a href="#paciente/${f.paciente_id}">${esc(f.paciente || '#' + f.paciente_id)}</a>` : '<span class="c-suave">—</span>'}</td>` : ''}
        <td class="detalle-aud">${resumenAuditoria(f)}</td>
        <td>${f.detalle ? `<button class="btn btn-icono" data-ver-detalle="${f.id}" title="Ver detalle completo">${icono('ver')}</button>` : ''}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

async function cargarAuditoria() {
  const sel = $('#aud-usuario');
  if (!sel.dataset.cargado) {
    const usuarios = await BD.listarUsuarios();
    sel.innerHTML = opciones(usuarios.map((u) => ({ valor: u.id, texto: `${u.nombre} ${u.apellido} (${u.email})` })), '', { vacioTexto: 'Todos los usuarios' });
    $('#aud-tabla-filtro').innerHTML = opciones(Object.entries(TABLAS_AUDITORIA).map(([k, t]) => ({ valor: k, texto: t })), '', { vacioTexto: 'Todo' });
    $('#aud-accion').innerHTML = opciones(Object.entries(ACCIONES_AUDITORIA).map(([k, [t]]) => ({ valor: k, texto: t })), '', { vacioTexto: 'Todas' });
    $('#aud-desde').value = sumarDias(hoy(), -7);
    $('#aud-hasta').value = hoy();
    sel.dataset.cargado = '1';
  }
  const a = APP.auditoria;
  $('#aud-tabla').innerHTML = cargando();
  const { filas, total } = await BD.listarAuditoria({ ...filtrosAuditoria(), pagina: a.pagina, porPagina: a.porPagina });
  a.filas = filas;
  $('#aud-total').textContent = `${numero(total)} registro${total === 1 ? '' : 's'}`;
  $('#aud-tabla').innerHTML = tablaAuditoria(filas);
  const paginas = Math.max(1, Math.ceil(total / a.porPagina));
  $('#aud-paginacion').innerHTML = `
    <span>Página ${a.pagina + 1} de ${paginas}</span>
    <div class="acciones">
      <button class="btn btn-sec btn-chico" data-pagina="${a.pagina - 1}" ${a.pagina === 0 ? 'disabled' : ''}>‹ Anterior</button>
      <button class="btn btn-sec btn-chico" data-pagina="${a.pagina + 1}" ${a.pagina + 1 >= paginas ? 'disabled' : ''}>Siguiente ›</button>
    </div>`;
}

function filtrosAuditoria() {
  return {
    desde: $('#aud-desde').value || null,
    hasta: $('#aud-hasta').value || null,
    usuarioId: $('#aud-usuario').value || null,
    accion: $('#aud-accion').value || null,
    tabla: $('#aud-tabla-filtro').value || null,
  };
}

function verDetalleAuditoria(id) {
  const f = APP.auditoria.filas.find((x) => x.id === id);
  if (!f) return;
  const d = f.detalle || {};
  const filas = f.accion === 'modificar'
    ? Object.entries(d).map(([k, [a, b]]) => `<tr><td><b>${esc(textoCampo(k))}</b></td><td>${esc(valorCompleto(a))}</td><td>${esc(valorCompleto(b))}</td></tr>`).join('')
    : Object.entries(d).map(([k, v]) => `<tr><td><b>${esc(textoCampo(k))}</b></td><td colspan="2">${esc(valorCompleto(v))}</td></tr>`).join('');
  abrirModal({
    titulo: `${(ACCIONES_AUDITORIA[f.accion] || [f.accion])[0]} · ${TABLAS_AUDITORIA[f.tabla] || f.tabla}`,
    tam: 'ancho', soloLectura: true,
    cuerpo: `<p class="ayuda" style="margin:0 0 12px">${fmtFechaHora(f.created_at)} · ${esc(f.usuario_email || 'Sistema')}${f.paciente ? ' · Paciente: ' + esc(f.paciente) : ''}</p>
      <div class="tabla-wrap"><table class="tabla"><thead><tr><th>Campo</th>${f.accion === 'modificar' ? '<th>Antes</th><th>Después</th>' : '<th colspan="2">Valor</th>'}</tr></thead>
      <tbody>${filas}</tbody></table></div>`,
  });
}
const valorCompleto = (v) => (v === null || v === undefined || v === '') ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));

async function exportarAuditoria() {
  try {
    let pagina = 0, todas = [];
    while (pagina < 20) {   // hasta 20.000 registros por exportación
      const { filas } = await BD.listarAuditoria({ ...filtrosAuditoria(), pagina, porPagina: 1000 });
      todas = todas.concat(filas);
      if (filas.length < 1000) break;
      pagina++;
    }
    exportarCSV(`auditoria_${hoy()}.csv`,
      ['Fecha y hora', 'Usuario', 'Rol', 'Acción', 'Sobre', 'Registro', 'Paciente', 'Detalle', 'IP'],
      todas.map((f) => [fmtFechaHora(f.created_at), f.usuario_email || 'Sistema', ROLES[f.usuario_rol] || '',
        (ACCIONES_AUDITORIA[f.accion] || [f.accion])[0], TABLAS_AUDITORIA[f.tabla] || f.tabla, f.registro_id || '',
        f.paciente || '', f.detalle ? JSON.stringify(f.detalle) : '', f.ip || '']));
  } catch (e) { avisoError(e); }
}

// ---------------------------------------------------------------------
// 19. MARCO LEGAL
//     Ley 25.326 (datos personales) · Ley 26.529 (derechos del paciente
//     e historia clínica) · Ley 27.706 y Decreto 393/2023 (HC electrónica)
// ---------------------------------------------------------------------

// --- Historia clínica inalterable: plazo de corrección y enmiendas ---
const limiteEdicion = (c) => new Date(new Date(c.created_at).getTime() + HORAS_EDICION_HC * 3600000).toISOString();
const consultaEditable = (c) => Date.now() < new Date(limiteEdicion(c)).getTime();

async function recargarFicha() {
  APP.ficha.paciente = await BD.obtenerPaciente(APP.ficha.paciente.id);
  pintarCabeceraFicha();
  await pintarFicha();
}

function modalEnmienda(c) {
  const prof = c.profesionales ? `${c.profesionales.apellido}, ${c.profesionales.nombre}` : '';
  abrirModal({
    titulo: 'Agregar enmienda a la historia clínica', textoGuardar: 'Guardar enmienda',
    cuerpo: `
      <div class="nota" style="margin-bottom:14px">
        Consulta del <b>${fmtFechaHora(c.fecha)}</b>${prof ? ` · ${esc(prof)}` : ''}<br>
        Motivo: ${esc(c.motivo)}${c.diagnostico ? ` · Diagnóstico: ${esc(c.diagnostico)}` : ''}
      </div>
      <p class="ayuda" style="margin:0 0 12px">La enmienda <b>no reemplaza</b> lo registrado: se agrega debajo con tu nombre, la fecha y la hora,
        y no se puede modificar ni borrar (Ley 26.529, art. 13).</p>
      <div class="campo"><label>Texto de la enmienda <span class="req">*</span></label>
        <textarea name="texto" rows="4" required minlength="3" placeholder="Ej.: Se corrige la agudeza visual del OD: 8/10 (no 6/10)."></textarea></div>`,
    onGuardar: async (d) => {
      await BD.agregarEnmienda(c.id, d.texto, rol() === 'medico' ? APP.perfil.profesional_id : null);
      aviso('Enmienda registrada');
      APP.ficha.pestana = 'historia';
      await pintarFicha();
    },
  });
}

// --- Conservación: baja lógica del paciente ---
function modalBajaPaciente(id, nombre, despues) {
  abrirModal({
    titulo: 'Dar de baja al paciente', tam: 'chico', textoGuardar: 'Dar de baja', claseGuardar: 'btn-peligro',
    cuerpo: `
      <p style="margin:0 0 12px;line-height:1.5"><b>${esc(nombre)}</b> dejará de aparecer en las búsquedas y no se le podrán dar turnos.
        Sus turnos futuros pendientes se cancelan.</p>
      <p class="ayuda" style="margin:0 0 14px">Su historia clínica y sus turnos <b>se conservan</b> (Ley 26.529: mínimo 10 años). Se puede reactivar en cualquier momento.</p>
      <div class="campo"><label>Motivo <span class="req">*</span></label>
        <input name="motivo" required maxlength="200" placeholder="Ej.: Se mudó · Paciente duplicado · Fallecimiento"></div>`,
    onGuardar: async (d) => {
      await BD.darDeBajaPaciente(id, d.motivo);
      aviso('Paciente dado de baja');
      if (despues) await despues();
    },
  });
}

// --- Compromiso de confidencialidad (primer ingreso de cada usuario) ---
function pedirConfidencialidad() {
  return new Promise((resolver) => {
    const optica = esc(APP.config?.nombre_optica || 'la óptica');
    abrirModal({
      titulo: 'Compromiso de confidencialidad', tam: 'ancho', bloqueante: true,
      textoGuardar: 'Acepto el compromiso', textoCancelar: 'No acepto (salir)',
      cuerpo: `
        <p style="margin:0 0 12px;line-height:1.55">Antes de usar el sistema por primera vez, tenés que aceptar este compromiso.
          Se basa en el deber de confidencialidad de la <b>Ley 25.326</b> (art. 10), el derecho del paciente a la confidencialidad
          de la <b>Ley 26.529</b> (art. 2) y el secreto profesional.</p>
        <ol class="lista-legal">
          <li>La información de los pacientes de ${optica}, en especial la de salud, es <b>confidencial</b>. La uso solo para las tareas propias de mi función.</li>
          <li><b>No comparto</b> mi usuario ni mi contraseña, y <b>cierro la sesión</b> al dejar la computadora.</li>
          <li>No copio, fotografío, imprimo, exporto ni envío datos de pacientes más allá de lo necesario para la atención.</li>
          <li>Sé que mis <b>accesos y acciones quedan registrados</b> en la auditoría del sistema.</li>
          <li>Esta obligación <b>continúa</b> aun después de terminar mi relación con ${optica}.</li>
        </ol>
        <p class="ayuda" style="margin:12px 0 0">Al aceptar, se registran la fecha y la hora. Si no aceptás, se cierra la sesión.</p>`,
      onGuardar: async () => {
        await BD.aceptarConfidencialidad();
        APP.perfil.confidencialidad_aceptada_at = new Date().toISOString();
        resolver(true);
      },
      onCancelar: () => resolver(false),
    });
  });
}

// --- Ventana de impresión con el encabezado de la óptica ---
function ventanaImpresion(titulo, contenido) {
  const cfg = APP.config || {};
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { aviso('El navegador bloqueó la ventana de impresión. Permití ventanas emergentes.', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
    <style>
      body{font-family:Lato,Arial,sans-serif;color:#2F3A42;margin:36px;font-size:13px;line-height:1.5}
      .cab{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2196F3;padding-bottom:12px;margin-bottom:20px}
      .cab h1{margin:0;font-size:20px} .cab small{color:#6F7D88} .cab img{max-height:56px}
      h2{font-size:17px;margin:0 0 10px} h3{font-size:14px;margin:18px 0 6px}
      table{border-collapse:collapse;width:100%;margin:8px 0} th,td{border:1px solid #C9D2D9;padding:6px 8px;text-align:left;vertical-align:top}
      th{background:#F6F8FA;font-size:11.5px}
      .receta td,.receta th{text-align:center} .receta td:first-child{font-weight:700;background:#F6F8FA}
      .datos{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px}
      .consulta{border:1px solid #DFE5EA;border-radius:6px;padding:10px 14px;margin:12px 0;break-inside:avoid}
      .consulta .t{font-weight:700} .consulta .p{color:#6F7D88}
      dl{display:grid;grid-template-columns:140px 1fr;gap:2px 10px;margin:8px 0} dt{color:#6F7D88} dd{margin:0}
      .enm{background:#FEF4E2;border-left:3px solid #F0A92E;padding:6px 10px;margin-top:8px}
      ol li{margin-bottom:6px} .legal{font-size:11.5px;color:#4A5660;border:1px solid #DFE5EA;padding:10px;border-radius:6px;margin-top:14px}
      .firmas{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:70px}
      .firmas div{border-top:1px solid #2F3A42;padding-top:6px;text-align:center;font-size:12px}
      .casilla{display:inline-block;width:12px;height:12px;border:1px solid #2F3A42;margin-right:6px;vertical-align:-2px}
      .pie{margin-top:24px;font-size:11px;color:#6F7D88;border-top:1px solid #DFE5EA;padding-top:8px}
      @media print{body{margin:14mm}}
    </style></head><body>
    <div class="cab"><div><h1>${esc(cfg.nombre_optica || 'Óptica')}</h1>
      <small>${esc([cfg.razon_social, cfg.cuit ? 'CUIT ' + cfg.cuit : '', cfg.direccion, cfg.telefono, cfg.email].filter(Boolean).join(' · '))}</small></div>
      ${cfg.logo_url ? `<img src="${esc(cfg.logo_url)}" alt="">` : ''}</div>
    ${contenido}
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

// --- Formulario de información y consentimiento (Ley 25.326) ---
function imprimirConsentimiento(p) {
  BD.registrarAcceso('imprimir', 'pacientes', p.id, { documento: 'formulario_consentimiento' });
  const cfg = APP.config || {};
  const responsable = esc(cfg.razon_social || cfg.nombre_optica || 'la óptica');
  const contacto = esc([cfg.direccion, cfg.email, cfg.telefono].filter(Boolean).join(' · ') || 'el domicilio de la óptica');
  const e = edad(p.fecha_nacimiento);
  ventanaImpresion('Consentimiento de datos personales', `
    <h2>Información y consentimiento para el tratamiento de datos personales y de salud</h2>
    <div class="datos">
      <div><b>Paciente:</b> ${esc(p.apellido)}, ${esc(p.nombre)}</div><div><b>DNI:</b> ${esc(p.dni)}</div>
      <div><b>Fecha de nacimiento:</b> ${fmtFecha(p.fecha_nacimiento) || '—'}</div><div><b>Teléfono:</b> ${esc(p.telefono || '—')}</div>
    </div>
    <p>En cumplimiento de la <b>Ley N° 25.326</b> de Protección de los Datos Personales y de la <b>Ley N° 26.529</b> de Derechos del Paciente, se le informa:</p>
    <ol>
      <li><b>Responsable de la base de datos:</b> ${responsable}${cfg.cuit ? `, CUIT ${esc(cfg.cuit)}` : ''}, con domicilio y contacto en ${contacto}. Sus datos se incorporan a la base de datos de pacientes, de la que es responsable.</li>
      <li><b>Finalidad:</b> gestionar sus turnos, brindarle atención oftalmológica y óptica, registrar su historia clínica y sus recetas, facturar las prácticas y comunicarse con usted por temas vinculados a su atención.</li>
      <li><b>Datos de salud:</b> son datos sensibles. Se tratan bajo secreto profesional y solo acceden las personas autorizadas, según su función. Todos los accesos quedan registrados.</li>
      <li><b>Carácter de los datos:</b> los datos de identificación y de salud son necesarios para su atención. Si no se brindan, la atención puede verse imposibilitada.</li>
      <li><b>Conservación:</b> su historia clínica se conserva por un plazo mínimo de <b>diez (10) años</b> (Ley 26.529, art. 18), aun si usted revoca este consentimiento.</li>
      <li><b>Alojamiento de la información:</b> los datos se guardan en servidores de un proveedor de servicios en la nube que pueden estar ubicados <b>fuera de la República Argentina</b>, con medidas de seguridad, acceso restringido y cifrado en la transmisión.</li>
      <li><b>Sus derechos:</b> puede solicitar el <b>acceso</b> a sus datos en forma gratuita a intervalos no inferiores a seis meses, salvo que acredite un interés legítimo (Ley 25.326, art. 14, inc. 3), y su <b>rectificación, actualización o supresión</b> (art. 16), excepto los datos que la ley obliga a conservar. Además, tiene derecho a recibir una <b>copia de su historia clínica</b> dentro de las 48 horas de solicitada (Ley 26.529, art. 14). Puede ejercer estos derechos ante ${contacto}.</li>
    </ol>
    <div class="legal">La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</div>
    <h3>Consentimiento</h3>
    <p><span class="casilla"></span> Presto mi consentimiento libre, expreso e informado para el tratamiento de mis datos personales y de salud con las finalidades indicadas, incluido su alojamiento en servidores ubicados fuera del país.</p>
    <p><span class="casilla"></span> Acepto recibir recordatorios de turnos por WhatsApp, SMS o correo electrónico (opcional).</p>
    <div class="firmas">
      <div>Firma del paciente${e !== null && e < 18 ? ' o de su representante legal' : ''}</div>
      <div>Aclaración y DNI${e !== null && e < 18 ? ' (del representante)' : ''}</div>
    </div>
    <p style="margin-top:28px">Lugar y fecha: ____________________________________</p>
    <div class="pie">Formulario generado el ${fmtFechaHora(new Date().toISOString())}. Conservar el original firmado.</div>`);
}

// --- Copia completa de la historia clínica (Ley 26.529, art. 14) ---
async function imprimirHistoriaClinica(p) {
  try {
    const consultas = (await BD.listarConsultas(p.id)).sort((a, b) => a.fecha.localeCompare(b.fecha));
    BD.registrarAcceso('imprimir', 'consultas', p.id, { documento: 'historia_clinica_completa', consultas: consultas.length });
    const item = (t, v) => v ? `<dt>${t}</dt><dd>${esc(v)}</dd>` : '';
    const cuerpo = consultas.map((c, i) => {
      const prof = c.profesionales || {};
      const av = (c.av_od_sc || c.av_oi_sc || c.av_od_cc || c.av_oi_cc)
        ? `OD ${c.av_od_sc || '—'} sc / ${c.av_od_cc || '—'} cc · OI ${c.av_oi_sc || '—'} sc / ${c.av_oi_cc || '—'} cc` : '';
      const pio = (c.pio_od || c.pio_oi) ? `OD ${c.pio_od ?? '—'} · OI ${c.pio_oi ?? '—'} mmHg` : '';
      return `<div class="consulta">
        <div class="t">${i + 1}. Consulta del ${fmtFechaHora(c.fecha)}</div>
        <div class="p">${esc(prof.apellido ? `${prof.apellido}, ${prof.nombre}` : '')}${prof.matricula ? ` · ${esc(prof.matricula)}` : ''}${prof.especialidad ? ` · ${esc(prof.especialidad)}` : ''}
          · Registrada el ${fmtFechaHora(c.created_at)}</div>
        <dl>${item('Motivo', c.motivo)}${item('Antecedentes', c.antecedentes)}${item('Agudeza visual', av)}${item('Presión ocular', pio)}
          ${item('Diagnóstico', c.diagnostico)}${item('Indicaciones', c.indicaciones)}${item('Observaciones', c.observaciones)}</dl>
        ${(c.recetas || []).map((r) => `<div><b>Receta · ${esc(TIPOS_RECETA[r.tipo] || r.tipo)}</b></div>
          <table class="receta">${tablaReceta(r).replace(/^<table[^>]*>/, '').replace(/<\/table>$/, '')}</table>
          ${r.observaciones ? `<div>${esc(r.observaciones)}</div>` : ''}`).join('')}
        ${(c.enmiendas_hc || []).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((en) =>
          `<div class="enm"><b>Enmienda</b> · ${fmtFechaHora(en.created_at)} · ${esc(en.autor || '')}<br>${esc(en.texto)}</div>`).join('')}
      </div>`;
    }).join('');
    const usuario = `${APP.perfil.nombre} ${APP.perfil.apellido}`.trim() || APP.perfil.email;
    ventanaImpresion(`Historia clínica · ${p.apellido}, ${p.nombre}`, `
      <h2>Copia de historia clínica</h2>
      <div class="datos">
        <div><b>Paciente:</b> ${esc(p.apellido)}, ${esc(p.nombre)}</div><div><b>DNI:</b> ${esc(p.dni)}</div>
        <div><b>Fecha de nacimiento:</b> ${fmtFecha(p.fecha_nacimiento) || '—'}</div>
        <div><b>Cobertura:</b> ${esc(p.obra_social || '—')} ${esc(p.nro_afiliado || '')}</div>
        <div><b>Domicilio:</b> ${esc([p.direccion, p.localidad].filter(Boolean).join(', ') || '—')}</div>
        <div><b>Consultas registradas:</b> ${consultas.length}</div>
      </div>
      ${cuerpo || '<p>El paciente no tiene consultas registradas.</p>'}
      <div class="firmas"><div>Firma y sello del responsable</div><div>Recibí copia: firma y aclaración del paciente</div></div>
      <div class="pie">Copia emitida el ${fmtFechaHora(new Date().toISOString())} por ${esc(usuario)}, a solicitud del paciente
        (Ley 26.529, art. 14). La historia clínica original se conserva en el sistema y es inalterable.</div>`);
  } catch (e) { avisoError(e); }
}
