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
| `llamador.html` | Pantalla de la sala de espera que llama a los pacientes (pantalla + voz) |
| `database.sql` | Script de la base de datos (no se publica en este repositorio) |
| `llamador.sql` | Actualización de la base para el llamador (no se publica en este repositorio) |

## Puesta en marcha
1. En Supabase: **SQL Editor → New query**, pegar `database.sql` y ejecutar.
2. Poner la URL y la clave pública del proyecto en `conexion.js`.
3. Abrir `index.html` (o publicarlo con GitHub Pages).

## Roles
- **Administrador:** acceso total.
- **Médico:** agenda, pacientes e historia clínica (edita solo sus consultas).
- **Recepción:** turnos y pacientes, sin historia clínica.

## Llamador de pacientes
1. Recepción marca **Llegó** y el paciente pasa a la **sala de espera**.
2. El médico (que al ingresar elige su consultorio del día) toca **Llamar**.
3. La pantalla `llamador.html` (botón **Llamador** del sistema) muestra el nombre y el consultorio y lo anuncia por voz.

Cada ventana del llamador puede estar **con voz** (TV de la sala) o **solo mostrar** (PCs de recepción y consultorios).

## Seguridad
- **RLS** (seguridad por filas) en todas las tablas: cada rol solo accede a lo que le corresponde.
- Los usuarios solo los crea un administrador; un registro externo queda desactivado y sin permisos.
- El navegador no guarda en caché las respuestas con datos; la sesión termina al cerrar el navegador
  y se cierra sola tras 20 minutos sin uso.
- **Auditoría** inmutable: quién crea, modifica, elimina, consulta, imprime o exporta información y cuándo
  (pantalla *Auditoría* y pestaña *Registro de accesos* en la ficha del paciente, solo administradores).

## Marco legal (Argentina)
- **Ley 26.529 / Ley 27.706:** historia clínica inalterable (las consultas se corrigen solo dentro de las 24 h;
  después, únicamente con enmiendas firmadas), nada se borra y los pacientes se dan de **baja lógica**;
  copia completa de la historia clínica para entregar al paciente.
- **Ley 25.326:** registro del consentimiento del paciente con formulario imprimible (incluye el texto
  obligatorio de la AAIP) y compromiso de confidencialidad que acepta cada usuario.

## Integración con WhatsApp (n8n)
La base incluye `turnos_disponibles(profesional, fecha)` y `solicitar_turno(...)` para recibir pedidos de turno desde un flujo de n8n.
