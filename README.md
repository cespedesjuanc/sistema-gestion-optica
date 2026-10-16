# Sistema de Gestión Óptica

Sistema web de gestión para ópticas: turnos, pacientes con historia clínica y recetas, profesionales, prácticas y tarifas, reportes y administración de usuarios por rol.

Proyecto profesionalizante — Ciencia de Datos, ISFT N° 244 Marcos Paz.

## Tecnologías
- HTML, CSS y JavaScript (sin frameworks ni compilación)
- [Supabase](https://supabase.com) (PostgreSQL + autenticación + seguridad por filas)
- Chart.js para los gráficos

## Archivos
| Archivo | Contenido |
|---|---|
| `index.html` | Estructura de todas las pantallas |
| `style.css` | Estilos del sistema |
| `conexion.js` | Conexión a Supabase |
| `reportes.js` | Todas las consultas a la base de datos |
| `logica.js` | Lógica de la interfaz, permisos y formularios |
| `database.sql` | Script de la base de datos (no se publica en este repositorio) |

## Puesta en marcha
1. En Supabase: **SQL Editor → New query**, pegar `database.sql` y ejecutar.
2. Poner la URL y la clave pública del proyecto en `conexion.js`.
3. Abrir `index.html` (o publicarlo con GitHub Pages).

## Roles
- **Administrador:** acceso total.
- **Médico:** agenda, pacientes e historia clínica (edita solo sus consultas).
- **Recepción:** turnos y pacientes, sin historia clínica.

## Integración con WhatsApp (n8n)
La base incluye `turnos_disponibles(profesional, fecha)` y `solicitar_turno(...)` para recibir pedidos de turno desde un flujo de n8n.
