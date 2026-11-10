/* =========================================================
   DATOS — Consola Muscari (Firestore)
   =========================================================
   Todo el acceso a datos de la consola vive aquí. El resto
   del código (js/consola.js) solo usa estas funciones:

     MuscariDatos.listar()                -> Promise<Array>
     MuscariDatos.actualizarEstado(id, e) -> Promise<void>
     MuscariDatos.eliminar(id)            -> Promise<void>

   Usa la API REST de Firestore con fetch (sin librerías) y el
   token del inicio de sesión. Colección: "solicitudes".

   FORMA DE UN REGISTRO
     id          texto único
     tipo        "mesa" | "evento" | "inscripcion"
     estado      "pendiente" | "confirmada" | "cancelada"
     recibidoEn  fecha y hora ISO de cuando llegó el formulario
     ...y los campos del formulario correspondiente
   ========================================================= */

(function () {
  "use strict";

  var PROYECTO = "muscari-bistro";
  var BASE = "https://firestore.googleapis.com/v1/projects/" + PROYECTO + "/databases/(default)/documents";

  function conToken(url, opciones) {
    return window.MuscariAuth.token().then(function (token) {
      opciones.headers = Object.assign({ Authorization: "Bearer " + token }, opciones.headers || {});

      return fetch(url, opciones);
    }).then(function (respuesta) {
      if (!respuesta.ok) throw new Error("Firestore respondió con estado " + respuesta.status);

      return respuesta;
    });
  }

  // Convierte un valor de Firestore ({stringValue: "x"}) a un valor normal.
  function leerValor(valor) {
    if ("stringValue" in valor) return valor.stringValue;
    if ("integerValue" in valor) return Number(valor.integerValue);
    if ("doubleValue" in valor) return valor.doubleValue;
    if ("booleanValue" in valor) return valor.booleanValue;
    if ("timestampValue" in valor) return valor.timestampValue;

    return "";
  }

  function documentoARegistro(documento) {
    var registro = { id: documento.name.split("/").pop() };

    Object.keys(documento.fields || {}).forEach(function (campo) {
      registro[campo] = leerValor(documento.fields[campo]);
    });

    return registro;
  }

  function listar() {
    var consulta = {
      structuredQuery: {
        from: [{ collectionId: "solicitudes" }],
        orderBy: [{ field: { fieldPath: "recibidoEn" }, direction: "DESCENDING" }],
        limit: 500,
      },
    };

    return conToken(BASE + ":runQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consulta),
    }).then(function (respuesta) {
      return respuesta.json();
    }).then(function (filas) {
      return filas
        .filter(function (fila) { return fila.document; })
        .map(function (fila) { return documentoARegistro(fila.document); });
    });
  }

  function actualizarEstado(id, estado) {
    var url = BASE + "/solicitudes/" + encodeURIComponent(id) + "?updateMask.fieldPaths=estado";

    return conToken(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { estado: { stringValue: estado } } }),
    }).then(function () {});
  }

  function eliminar(id) {
    return conToken(BASE + "/solicitudes/" + encodeURIComponent(id), {
      method: "DELETE",
    }).then(function () {});
  }

  window.MuscariDatos = {
    simulando: false,
    listar: listar,
    actualizarEstado: actualizarEstado,
    eliminar: eliminar,
  };
})();
