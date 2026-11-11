# Contexto del proyecto — Muscari Bistro (web + consola + Firebase)

Documento para retomar el trabajo en otro chat. Estado al 11 de noviembre de 2026.

## 1. Quién y qué

- Persona: Fernando (escribe en español). Trabaja en el sitio web de **Muscari Bistro** y se encarga de la parte de reservas.
- Restricción fuerte: **solo HTML5, CSS3 y JavaScript nativo**. Sin TypeScript, sin React/Angular/Vue ni otros frameworks de interfaz. Se permite Bootstrap o CSS propio.
- Contexto académico: el proyecto se evalúa en el curso *Desarrollo Web I* (ESEN), **Desafío Práctico II** (15 % de la nota: 10 % grupal y 5 % individual, grupos de 3). Ver sección 8.
- Nota de diseño: la identidad visual es la del sitio. Colores: crema `#F2EBDF`, arena `#E6DAC6`, línea `#CDBFA8`, oscuro `#211C17`, texto `#2B241E`, texto suave `#5A4636`, verde `#4D5E3A`, terracota `#B5613C` (texto accesible `#9A4E2B`). Títulos con Cormorant Garamond en mayúsculas y cuerpo con Satoshi.

## 2. Arquitectura actual

```
Web pública (GitHub Pages)  ──formularios──▶  Firestore (colección "solicitudes")  ◀──lee/edita/borra──  Consola interna (GitHub Pages)
 repo Fernandorec/Muscari_Bistroo                    proyecto Firebase                            repo Fernandorec/Muscari_consola
                                                      "muscari-bistro" (plan Spark)                  login con Firebase Authentication
```

- Dominio de GitHub Pages: `fernandorec.github.io` (ya autorizado en Firebase Authentication).
- Rutas esperadas: web en `fernandorec.github.io/Muscari_Bistroo/` y consola en `fernandorec.github.io/Muscari_consola/`.
- **No se usa ningún SDK ni librería de Firebase.** Todo es `fetch` contra las APIs REST de Firestore y de Identity Toolkit (para cumplir "solo JavaScript").
- Carpetas locales de Fernando (Windows): `C:\Users\fmgon\Desktop\Muscari_Bistroo\` (web, con `.git`) y `C:\Users\fmgon\Desktop\Consola-muscari\` (consola, con `.git`).

## 3. Web pública (repo `Muscari_Bistroo`)

Archivos tocados en este trabajo:

- `reservas.html`: se reemplazó el iframe de Google Calendar (mesa) y el de Google Forms (evento) por formularios propios `#form-mesa` y `#form-evento`.
- `eventos.html`: se reemplazó el Google Form de inscripción por `#form-inscripcion` (nombre, teléfono, correo, evento, personas, comentarios; el select trae Taller de pintura · 6 de Oct, Tarde de té con pintura · 8 de Oct, Mercado Navideño · 31 de Oct).
- `css/formularios.css` (nuevo): estilos de los formularios, variante clara y versión de escritorio de dos columnas desde 1038 px.
- `js/formularios.js` (nuevo): maneja todo formulario con `data-reservation-form`; el tipo sale de `data-reservation-type` (`mesa`, `evento`, `inscripcion`). Valida con `checkValidity`, muestra estados (enviando, éxito, error) y escribe un documento nuevo en Firestore con `documents:commit`:
  - `estado: "pendiente"` fijo.
  - `recibidoEn` lo pone el servidor (`setToServerValue: REQUEST_TIME`).
  - `personas` e `invitados` se guardan como entero; el resto como texto.
  - ID aleatorio de 20 caracteres generado en el cliente; `currentDocument: { exists: false }`.
- Pendientes menores conocidos: queda una etiqueta `<script src="./support.js">` sobrante en `eventos.html` y CSS muerto (`footer__`, iframe) en `reservas.css`. El `README.md` de la web está casi vacío.

## 4. Consola interna (repo `Muscari_consola`)

Solo HTML, CSS y JavaScript. Archivos:

| Archivo | Función |
| --- | --- |
| `index.html` | Inicio de sesión con correo y contraseña (botón mostrar/ocultar, redirige si ya hay sesión). |
| `consola.html` | Vistas: Resumen, Calendario, Reservas de mesa, Solicitudes de evento, Inscripciones. Diálogo `<dialog>` de detalle. |
| `css/consola.css` | Estilos con la misma identidad del sitio, adaptable a móvil. |
| `js/auth.js` | Firebase Authentication por REST (`accounts:signInWithPassword`). Guarda `{correo, idToken, refreshToken, venceEn}` en `sessionStorage`; `token()` renueva el JWT antes de que venza (dura 1 h). Expone `MuscariAuth`. |
| `js/datos.js` | Firestore por REST: `listar()` (runQuery ordenado por `recibidoEn` descendente, límite 500), `actualizarEstado(id, estado)` (PATCH con `updateMask` solo de `estado`) y `eliminar(id)` (DELETE). Expone `MuscariDatos`. |
| `js/consola.js` | Lógica de interfaz: vistas por hash (incluye el calendario), búsqueda, filtro por estado, indicadores del resumen, detalle, cambio de estado, eliminar con confirmación en dos pasos, avisos, estados de carga, error y vacío. Construye el DOM con una función `h()` sin `innerHTML`. |
| `README.md` | Actualizado: login real, datos en Firestore, seguridad. |

Forma de un registro: `id`, `tipo` (`mesa` | `evento` | `inscripcion`), `estado` (`pendiente` | `confirmada` | `cancelada`), `recibidoEn` (ISO) más los campos del formulario:

- mesa: nombre, telefono, correo, fecha, hora, personas, comentarios
- evento: nombre, telefono, correo, tipoEvento, fecha, invitados, mensaje
- inscripcion: nombre, telefono, correo, evento, personas, comentarios

Funciones de la consola hoy: iniciar y cerrar sesión, ver solicitudes, buscar, filtrar por estado, cambiar estado (confirmar, volver a pendiente, cancelar) y **eliminar** (primer clic "Eliminar", segundo clic "Sí, eliminar para siempre", opción "No, conservar").

Calendario (`#calendario`): mes en curso, con la misma identidad visual. En el resumen, el botón Calendario queda junto a Actualizar y abre esta vista. Al pasar el cursor el día se marca; al elegirlo se listan las reservas de mesa y las solicitudes de evento de esa `fecha`. Un punto verde es mesa y uno terracota es evento. Las inscripciones no aparecen porque no tienen fecha. Reutiliza el detalle y `MuscariDatos.listar()`; no escribe campos nuevos ni cambia las reglas de Firestore. `personas` e `invitados` siguen siendo enteros.

Ya no hay datos de ejemplo ni clave temporal (`admin` / `muscari2026` fue eliminada). El aviso "Modo demostración" quedó apagado (`simulando: false`).

## 5. Firebase (proyecto `muscari-bistro`)

- Plan Spark, Firestore `(default)` en modo producción, Authentication con **Correo electrónico/contraseña** habilitado.
- **Registro público de usuarios desactivado** (Authentication → Configuración → Acciones del usuario). Existe un usuario del equipo creado por Fernando; la contraseña la puso él (nunca debe pegarse en chats ni en el repositorio).
- UID del usuario del equipo: `A2SFlTUDq2eOPQeQdDdDFEcfHZA2` (contiene una letra que se confunde entre "I" mayúscula y "l" minúscula; copiarlo siempre desde la consola de Firebase, no de capturas de pantalla).
- App web registrada como `muscari-web`. Configuración (es pública por diseño; la protección real son las reglas):

```js
const firebaseConfig = {
  apiKey: "AIzaSyCvnbzagEcTEkS_Ey_XuxvkvKnEAKagPGk",
  authDomain: "muscari-bistro.firebaseapp.com",
  projectId: "muscari-bistro",
  storageBucket: "muscari-bistro.firebasestorage.app",
  messagingSenderId: "1063087299606",
  appId: "1:1063087299606:web:e47c5bb31b1aef7a04e937"
};
```

- Dominios autorizados: `localhost`, `muscari-bistro.firebaseapp.com`, `muscari-bistro.web.app` y `fernandorec.github.io`.

### Reglas de Firestore publicadas (versión actual)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function esEquipo() {
      return request.auth != null && request.auth.uid in ['A2SFlTUDq2eOPQeQdDdDFEcfHZA2'];
    }
    function datosValidos() {
      let d = request.resource.data;
      return d.keys().hasOnly(['tipo','nombre','telefono','correo','fecha','hora','personas','comentarios','tipoEvento','invitados','mensaje','evento','estado','recibidoEn'])
        && d.keys().hasAll(['tipo','nombre','telefono','correo','estado','recibidoEn'])
        && d.tipo in ['mesa','evento','inscripcion']
        && d.estado == 'pendiente'
        && d.nombre is string && d.nombre.size() > 0 && d.nombre.size() < 120
        && d.recibidoEn == request.time;
    }
    match /solicitudes/{id} {
      allow create: if datosValidos();
      allow read: if esEquipo();
      allow update: if esEquipo()
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['estado'])
        && request.resource.data.estado in ['pendiente','confirmada','cancelada'];
      allow delete: if esEquipo();
    }
  }
}
```

Significado: cualquiera puede **crear** una solicitud válida desde la web; solo el UID del equipo puede **leer**, **cambiar el estado** y **eliminar**.

Pruebas hechas desde el navegador: un envío válido se guarda (200); un envío con estado distinto de `pendiente`, un envío con campo extra y una lectura anónima fueron rechazados (403). Quedó un documento de prueba llamado "PRUEBA borrar" en `solicitudes` que Fernando debe borrar (ahora puede hacerlo desde la consola).

Nota técnica: el editor de reglas de la consola de Firebase **cierra llaves automáticamente** al escribir. Si se pega texto multilínea por tipeo, quedan llaves de más al final (error "Unexpected '}'"); hay que borrarlas.

## 6. Git y publicación (estado)

- Web (`Muscari_Bistroo`): en el repo remoto todavía **no existe** la carpeta `js/` ni los formularios nuevos. Los cambios están en la carpeta local sin commit. En ese repo también suben Rodrigo y Verónica (compañeros), por eso se recomendó subir a una rama aparte:
  ```
  git checkout -b conexion-firebase
  git add -A
  git commit -m "Conectar formularios a Firestore"
  git push -u origin conexion-firebase
  ```
  y luego hacer pull request y merge a la rama que publica GitHub Pages.
- Consola (`Muscari_consola`): Fernando hizo un primer commit "Consola" y el push se rechazó por commits remotos (README inicial). Solución indicada: `git pull --rebase origin main` (con `--allow-unrelated-histories` si hace falta) y luego `git push origin main`. Después activar GitHub Pages (Settings → Pages → rama `main`). El cambio de **eliminar** también debe subirse con `git add .`, `git commit` y `git push origin main`.
- Limitaciones de la sesión de Claude: no tiene terminal en la computadora de Fernando ni permiso de escritura en GitHub, así que **los commits y pushes los hace él**. El navegador conectado (Claude in Chrome) tiene la sesión de GitHub y de Firebase de Fernando, pero no puede subir archivos locales.

## 7. Cómo se trabajó (para no repetir errores)

- Fernando quiere que se use **su** código local como fuente de verdad, no la reconstrucción desde Claude Design. Cuando haya que cambiar algo, editar sobre sus archivos.
- Nunca pedir, escribir ni guardar contraseñas. Las credenciales de prueba para el profesor se entregan por Moodle, no en el repositorio.
- Las contestaciones deben ser en español, claras y cortas.

## 8. Rúbrica del Desafío Práctico II (resumen) y brechas actuales

Requisitos mínimos (17): resolver un problema con al menos dos procesos relacionados; registro, inicio y cierre de sesión con Firebase o Supabase; **al menos dos roles** con permisos distintos (nadie se vuelve administrador por su cuenta); autorización real con reglas de seguridad; persistencia remota en al menos dos entidades o colecciones; **CRUD completo** sobre una entidad; datos iniciales representativos; DOM dinámico; al menos dos operaciones de procesamiento de datos; formularios con validaciones; **async/await** con manejo de errores y retroalimentación; estados de carga, error y vacío; **código organizado en módulos ES**; interfaz adaptable y accesible; configuración segura; **publicación en hosting**; **repositorio de GitHub** con README (problema, procesos, tecnología, instrucciones y credenciales de prueba por Moodle). Pesos del grupo: procesos y requisitos 25 %, JavaScript 15 %, persistencia 20 %, autenticación y seguridad 15 %, interfaz 10 %, organización y documentación 5 %, trabajo en Git 5 %, hosting 5 %. La nota individual (5 %) es una comprobación técnica sin documentación ni IA, con una modificación pequeña al código.

Lo que **ya cumple**: dos procesos relacionados (formularios → consola), login y logout, reglas de seguridad reales sin secretos privilegiados, DOM dinámico, filtros e indicadores, validación de formularios, estados de carga/error/vacío, diseño adaptable y accesible, consulta y eliminación de solicitudes.

Lo que **falta o falla** (orden de prioridad sugerido):

1. **Módulos ES y async/await:** hoy el JS usa funciones autoejecutables (`(function(){})()`), `window.*` y `.then()`. Hay que migrar a `<script type="module">` con `import`/`export` (configuración, datos, interfaz separados) y a `async/await`.
2. **Registro de usuarios y dos roles:** el registro está desactivado y solo existe "equipo" (por UID) frente a "público anónimo". Propuesta: reactivar el registro de clientes, guardar el rol en una colección `usuarios/{uid}` con rol `cliente` y rol `admin`; las reglas deben forzar `rol == 'cliente'` al crear el perfil y el rol `admin` se asigna a mano en Firestore. Los clientes podrían crear reservas ligadas a su `uid` y ver solo las suyas.
3. **CRUD completo:** falta **editar** los datos de una solicitud (fecha, hora, personas, etc.). Hoy solo se cambia el estado.
4. **Datos iniciales:** la base quedó vacía; la rúbrica pide un conjunto representativo en Firebase.
5. **Al menos dos colecciones relacionadas:** hoy solo existe `solicitudes` (más `usuarios` si se hace el punto 2).
6. **Un solo repositorio:** las condiciones piden todos los archivos en un repositorio; hoy son dos (`Muscari_Bistroo` y `Muscari_consola`). Conviene confirmarlo con el profesor o unificar.
7. **README completos:** el de la web casi vacío; ambos deben describir el problema, procesos, tecnología e instrucciones de prueba, sin contraseñas.
8. **Trabajo en Git de los tres integrantes:** la consola está en un solo commit de Fernando; conviene repartir partes reales con commits progresivos de los tres.
9. **Publicación:** subir y publicar la web y la consola con las versiones nuevas y probar login y datos en la URL pública.
10. **Aprobación de la propuesta:** la rúbrica exige que el profesor apruebe antes una propuesta breve (problema, roles, procesos, entidades y plataforma). Confirmar que esto ya ocurrió.

## 9. Próximo paso acordado

Se propuso empezar por el punto 1 (módulos ES con async/await). Fernando pidió antes la opción de eliminar (hecha) y pidió este documento. Quedó ofrecida la función de **editar** solicitudes para completar el CRUD.
