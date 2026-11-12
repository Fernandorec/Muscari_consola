/* =========================================================
   AUTENTICACIÓN — Consola Muscari (Firebase Authentication)
   =========================================================
   Inicio de sesión real con correo y contraseña usando la
   API REST de Firebase Authentication (solo fetch, sin
   librerías). Las cuentas se administran en la consola de
   Firebase → Authentication → Usuarios.

   La protección de los datos NO está aquí: está en las reglas
   de seguridad de Firestore (solo el UID del equipo puede leer
   o cambiar las solicitudes). La apiKey es pública por diseño.
   ========================================================= */

(function () {
  "use strict";

  var API_KEY = "AIzaSyCvnbzagEcTEkS_Ey_XuxvkvKnEAKagPGk";
  var URL_LOGIN = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + API_KEY;
  var URL_REFRESCO = "https://securetoken.googleapis.com/v1/token?key=" + API_KEY;

  var CLAVE_SESION = "muscari_consola_sesion";

  // Lee la sesión guardada en el navegador (sessionStorage): correo y tokens.
  // Devuelve null si no hay nada o si el navegador no deja leerla.
  function leerSesion() {
    try {
      var texto = window.sessionStorage.getItem(CLAVE_SESION);

      return texto ? JSON.parse(texto) : null;
    } catch (e) {
      return null;
    }
  }

  // Guarda la sesión en sessionStorage (dura mientras la pestaña esté abierta).
  // Devuelve true si pudo guardarla y false si no.
  function guardarSesion(sesion) {
    try {
      window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
      return true;
    } catch (e) {
      return false;
    }
  }

  // Dice si hay una sesión guardada (true o false).
  // Solo mira que exista; no comprueba que el token sea válido.
  function haySesion() {
    return Boolean(leerSesion());
  }

  // Devuelve el correo de quien inició sesión, o "" si no hay sesión.
  function usuario() {
    var sesion = leerSesion();

    return sesion ? sesion.correo : "";
  }

  // Arma el objeto de sesión con la respuesta de Firebase:
  //   - idToken: el JWT que se manda a Firestore en cada petición.
  //   - refreshToken: sirve para pedir un idToken nuevo sin volver a escribir la contraseña.
  //   - venceEn: la hora exacta (en milisegundos) en que el idToken deja de servir.
  // Firebase usa nombres distintos al iniciar sesión y al renovar, por eso se aceptan los dos.
  function crearSesion(datos, correo) {
    return {
      correo: correo,
      idToken: datos.idToken || datos.id_token,
      refreshToken: datos.refreshToken || datos.refresh_token,
      venceEn: Date.now() + (Number(datos.expiresIn || datos.expires_in) || 3600) * 1000,
    };
  }

  // Envía el correo y la contraseña a Firebase. Si son correctos, guarda la sesión.
  // Devuelve true si el acceso fue correcto y false si no (clave incorrecta, sin internet, etc.).
  // Nunca lanza error: siempre responde true o false.
  async function iniciarSesion(correo, clave) {
    try {
      var respuesta = await fetch(URL_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo, password: clave, returnSecureToken: true }),
      });

      if (!respuesta.ok) return false;

      var datos = await respuesta.json();

      return guardarSesion(crearSesion(datos, correo));
    } catch (e) {
      return false;
    }
  }

  // Borra la sesión guardada y manda a la pantalla de inicio de sesión.
  function cerrarSesion() {
    try {
      window.sessionStorage.removeItem(CLAVE_SESION);
    } catch (e) {
      /* sin almacenamiento disponible: nada que limpiar */
    }

    window.location.replace("index.html");
  }

  // Se usa al inicio de las páginas protegidas.
  // Si hay sesión devuelve true; si no, manda al login y devuelve false.
  function exigirSesion() {
    if (haySesion()) return true;

    window.location.replace("index.html");
    return false;
  }

  // Entrega un token (JWT) vigente para llamar a Firestore.
  // Si el guardado todavía sirve (le queda más de 1 minuto), lo devuelve tal cual.
  // Si está por vencer, pide uno nuevo a Firebase con el refreshToken y lo guarda.
  // Si no se puede renovar, cierra la sesión.
  async function token() {
    var sesion = leerSesion();

    if (!sesion) throw new Error("Sin sesión");

    if (Date.now() < sesion.venceEn - 60000) return sesion.idToken;

    try {
      var respuesta = await fetch(URL_REFRESCO, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(sesion.refreshToken),
      });

      if (!respuesta.ok) throw new Error("Sesión vencida");

      var datos = await respuesta.json();
      var nueva = crearSesion(datos, sesion.correo);

      guardarSesion(nueva);
      return nueva.idToken;
    } catch (error) {
      cerrarSesion();
      throw error;
    }
  }

  window.MuscariAuth = {
    haySesion: haySesion,
    usuario: usuario,
    iniciarSesion: iniciarSesion,
    cerrarSesion: cerrarSesion,
    exigirSesion: exigirSesion,
    token: token,
  };
})();
