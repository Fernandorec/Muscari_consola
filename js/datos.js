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

  async function conToken(url, opciones) {
    var token = await window.MuscariAuth.token();

    opciones.headers = Object.assign({ Authorization: "Bearer " + token }, opciones.headers || {});

    var respuesta = await fetch(url, opciones);

    if (!respuesta.ok) throw new Error("Firestore respondió con estado " + respuesta.status);

    return respuesta;
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

  async function listar() {
    var consulta = {
      structuredQuery: {
        from: [{ collectionId: "solicitudes" }],
        orderBy: [{ field: { fieldPath: "recibidoEn" }, direction: "DESCENDING" }],
        limit: 500,
      },
    };

    var respuesta = await conToken(BASE + ":runQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(consulta),
    });

    var filas = await respuesta.json();

    return filas
      .filter(function (fila) { return fila.document; })
      .map(function (fila) { return documentoARegistro(fila.document); });
  }

  async function actualizarEstado(id, estado) {
    var url = BASE + "/solicitudes/" + encodeURIComponent(id) + "?updateMask.fieldPaths=estado";

    await conToken(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { estado: { stringValue: estado } } }),
    });
  }

  async function eliminar(id) {
    await conToken(BASE + "/solicitudes/" + encodeURIComponent(id), {
      method: "DELETE",
    });
  }

  window.MuscariDatos = {
    simulando: false,
    listar: listar,
    actualizarEstado: actualizarEstado,
    eliminar: eliminar,
  };
})();
