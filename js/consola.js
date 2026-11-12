/* =========================================================
   CONSOLA MUSCARI — lógica de la interfaz
   Solo HTML/CSS/JS, sin librerías.

   Importante: los datos vienen de formularios públicos, así
   que NUNCA se insertan como HTML. Todo se escribe con
   textContent / createElement (ver helper h()).
   ========================================================= */

(function () {
  "use strict";

  if (!window.MuscariAuth.exigirSesion()) return;

  /* -------------------------
     Configuración de vistas
  ------------------------- */

  // Cómo se escribe cada estado en pantalla (en la base de datos se guarda en minúsculas).
  var ESTADOS = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
  };

  // Describe cada lista (mesa, evento, inscripción): su título, las columnas de la tabla
  // y los campos que se ven en el detalle. Los nombres de campo son los del formulario de la web.
  var VISTAS = {
    mesa: {
      titulo: "Reservas de mesa",
      etiqueta: "Mesa",
      descripcion: "Solicitudes enviadas desde el formulario de reserva de mesa.",
      columnas: [
        ["nombre", "Nombre"],
        ["fecha", "Fecha"],
        ["hora", "Hora"],
        ["personas", "Personas"],
      ],
      detalle: [
        ["nombre", "Nombre completo"],
        ["telefono", "Teléfono"],
        ["correo", "Correo"],
        ["fecha", "Fecha"],
        ["hora", "Hora"],
        ["personas", "Personas"],
        ["comentarios", "Comentarios"],
      ],
    },
    evento: {
      titulo: "Solicitudes de evento",
      etiqueta: "Evento",
      descripcion: "Personas que quieren organizar un evento en Muscari.",
      columnas: [
        ["nombre", "Nombre"],
        ["tipoEvento", "Tipo de evento"],
        ["fecha", "Fecha tentativa"],
        ["invitados", "Invitados"],
      ],
      detalle: [
        ["nombre", "Nombre completo"],
        ["telefono", "Teléfono"],
        ["correo", "Correo"],
        ["tipoEvento", "Tipo de evento"],
        ["fecha", "Fecha tentativa"],
        ["invitados", "Invitados"],
        ["mensaje", "Qué imagina"],
      ],
    },
    inscripcion: {
      titulo: "Inscripciones a eventos",
      etiqueta: "Inscripción",
      descripcion: "Personas que se apuntaron a los eventos de la agenda.",
      columnas: [
        ["nombre", "Nombre"],
        ["evento", "Evento"],
        ["personas", "Personas"],
      ],
      detalle: [
        ["nombre", "Nombre completo"],
        ["telefono", "Teléfono"],
        ["correo", "Correo"],
        ["evento", "Evento"],
        ["personas", "Personas"],
        ["comentarios", "Comentarios"],
      ],
    },
  };

  /* -------------------------
     Estado
  ------------------------- */

  // Nombres de los meses y de los días, para dibujar el calendario.
  var MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  var DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Todas las solicitudes cargadas desde Firestore. Las pantallas filtran y muestran esta lista.
  var registros = [];
  // Lo que el usuario escribió en el buscador y el estado elegido en el filtro.
  var filtros = { busqueda: "", estado: "" };
  // Pantalla que se está mostrando (resumen, calendario, mesa, evento o inscripcion).
  var vistaActual = "";
  // Solicitud cuyo detalle está abierto en la ventana (null si no hay ninguna).
  var registroAbierto = null;
  // Piezas de la tabla actual, guardadas para repintar las filas sin rehacer toda la pantalla.
  var cuerpoTabla = null;
  var contador = null;
  var hoyInicial = new Date();
  // Estado del calendario: mes y año que se ven, y el día seleccionado ("AAAA-MM-DD").
  var calendario = {
    anio: hoyInicial.getFullYear(),
    mes: hoyInicial.getMonth(),
    seleccion: claveDesdeDate(hoyInicial),
  };

  // Elementos fijos de consola.html: donde se dibuja la pantalla, la ventana de detalle y el aviso.
  var contenedor = document.getElementById("vista");
  var dialogo = document.getElementById("detalle");
  var toastEl = document.getElementById("toast");

  /* -------------------------
     Utilidades
  ------------------------- */

  // Crea un elemento HTML de forma segura (sin innerHTML).
  // Uso: h("p", { clase: "vacio", texto: "Hola" }, hijo1, hijo2)
  //   - "texto" se escribe como texto puro, así nadie puede colar HTML.
  //   - "clase" pone la clase CSS; cualquier otra clave se pone como atributo (href, id, type...).
  //   - Los hijos pueden ser texto, otros elementos o listas de elementos.
  function h(etiqueta, propiedades) {
    var nodo = document.createElement(etiqueta);
    var props = propiedades || {};

    Object.keys(props).forEach(function (clave) {
      if (clave === "texto") nodo.textContent = props[clave];
      else if (clave === "clase") nodo.className = props[clave];
      else nodo.setAttribute(clave, props[clave]);
    });

    // Agrega un hijo al elemento: ignora los vacíos, abre las listas y convierte el texto en texto.
    function agregar(hijo) {
      if (hijo === null || hijo === undefined || hijo === false) return;

      if (Array.isArray(hijo)) {
        hijo.forEach(agregar);
        return;
      }

      nodo.appendChild(typeof hijo === "string" ? document.createTextNode(hijo) : hijo);
    }

    for (var i = 2; i < arguments.length; i++) agregar(arguments[i]);

    return nodo;
  }

  // Dice si un valor está "vacío": no existe o solo tiene espacios.
  function vacio(valor) {
    return valor === undefined || valor === null || String(valor).trim() === "";
  }

  // Le pone un cero adelante a los números menores de 10 (5 -> "05"), para armar fechas.
  function dosDigitos(numero) {
    return (numero < 10 ? "0" : "") + numero;
  }

  // Convierte una fecha (Date) en texto "AAAA-MM-DD". Esa "clave" sirve para comparar días
  // y para encontrar las solicitudes de un día en el calendario.
  function claveDesdeDate(fecha) {
    return fecha.getFullYear() + "-" + dosDigitos(fecha.getMonth() + 1) + "-" + dosDigitos(fecha.getDate());
  }

  // Convierte un texto "AAAA-MM-DD" en una fecha (Date) a las 00:00 hora local.
  // Si el texto no tiene ese formato devuelve null. Se arma con año, mes y día por separado
  // para que la zona horaria no la corra un día.
  function fechaLocal(texto) {
    var coincidencia = String(texto || "").match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (!coincidencia) return null;

    return new Date(Number(coincidencia[1]), Number(coincidencia[2]) - 1, Number(coincidencia[3]));
  }

  // Devuelve el día ("AAAA-MM-DD") de una solicitud según su campo fecha, o "" si no tiene fecha válida.
  function claveDeRegistro(registro) {
    var fecha = fechaLocal(registro.fecha);

    return fecha ? claveDesdeDate(fecha) : "";
  }

  // Muestra una fecha "AAAA-MM-DD" de forma legible (ej. "jue, 12 nov 2026").
  // Si no se puede convertir, devuelve el texto tal cual.
  function formatearFecha(texto) {
    var fecha = fechaLocal(texto);

    if (!fecha || isNaN(fecha.getTime())) return texto;

    return fecha.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  // Muestra cuándo llegó una solicitud (ej. "12 nov, 14:30") a partir de la fecha que guarda Firestore.
  // Devuelve "" si la fecha no es válida.
  function formatearRecibido(iso) {
    var fecha = new Date(iso);

    if (isNaN(fecha.getTime())) return "";

    return fecha.toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  // Devuelve el texto de una celda de la tabla: "—" si está vacío, la fecha formateada si es "fecha",
  // o el valor tal cual en los demás casos.
  function valorVisible(clave, registro) {
    var valor = registro[clave];

    if (vacio(valor)) return "—";
    if (clave === "fecha") return formatearFecha(valor);

    return String(valor);
  }

  // Crea la etiqueta de color con el estado de una solicitud (Pendiente, Confirmada o Cancelada).
  function insignia(estado) {
    return h("span", { clase: "estado estado--" + estado, texto: ESTADOS[estado] || estado });
  }

  // Muestra un aviso flotante (toast) durante 3,2 segundos.
  // Si llega otro aviso antes de que termine, reinicia el temporizador.
  function mostrarAviso(texto) {
    toastEl.textContent = texto;
    toastEl.classList.add("toast--visible");

    window.clearTimeout(mostrarAviso.temporizador);
    mostrarAviso.temporizador = window.setTimeout(function () {
      toastEl.classList.remove("toast--visible");
    }, 3200);
  }

  // Cuenta cuántas solicitudes de un tipo (mesa, evento o inscripcion) siguen pendientes.
  function pendientesDe(tipo) {
    return registros.filter(function (r) {
      return r.tipo === tipo && r.estado === "pendiente";
    }).length;
  }

  // Pone en los globitos del menú lateral la cantidad de pendientes de cada tipo.
  // Si no hay ninguna, el globito se oculta.
  function actualizarInsignias() {
    Object.keys(VISTAS).forEach(function (tipo) {
      var insigniaNav = document.querySelector('[data-badge="' + tipo + '"]');
      var cantidad = pendientesDe(tipo);

      insigniaNav.hidden = cantidad === 0;
      insigniaNav.textContent = cantidad;
      insigniaNav.setAttribute("aria-label", cantidad + " pendientes");
    });
  }

  /* -------------------------
     Vista: Resumen
  ------------------------- */

  // Crea una tarjeta del resumen con los pendientes por revisar y el total de un tipo.
  // Al hacer clic lleva a la lista de ese tipo.
  function tarjetaResumen(tipo) {
    var vista = VISTAS[tipo];
    var total = registros.filter(function (r) { return r.tipo === tipo; }).length;
    var pendientes = pendientesDe(tipo);

    return h("a", { clase: "tarjeta", href: "#" + tipo },
      h("span", { clase: "eyebrow", texto: vista.etiqueta }),
      h("span", { clase: "tarjeta__numero", texto: String(pendientes) }),
      h("span", { clase: "tarjeta__texto", texto: pendientes === 1 ? "pendiente por revisar" : "pendientes por revisar" }),
      h("span", { clase: "tarjeta__pie", texto: total + " en total · Ver todas →" })
    );
  }

  // Crea una fila clicable (nombre, resumen y estado) para las listas del resumen.
  // Al hacer clic abre el detalle de la solicitud.
  function filaCorta(registro) {
    var vista = VISTAS[registro.tipo];

    var boton = h("button", { type: "button", clase: "lista-corta__item" },
      h("span", { clase: "lista-corta__quien" },
        h("strong", { texto: registro.nombre }),
        h("span", { texto: vista.etiqueta + " · " + resumenCorto(registro) })
      ),
      insignia(registro.estado)
    );

    boton.addEventListener("click", function () { abrirDetalle(registro); });

    return h("li", {}, boton);
  }

  // Arma la línea de resumen de una solicitud según su tipo:
  // mesa = fecha, hora y personas; evento = tipo y fecha; inscripción = evento y personas.
  function resumenCorto(registro) {
    if (registro.tipo === "mesa") return formatearFecha(registro.fecha) + " · " + registro.hora + " · " + registro.personas + " pers.";
    if (registro.tipo === "evento") return registro.tipoEvento + " · " + formatearFecha(registro.fecha);

    return registro.evento + " · " + registro.personas + " pers.";
  }

  // Dibuja la pantalla "Resumen": tarjetas por tipo, las próximas 5 reservas de mesa
  // (no canceladas, de hoy en adelante) y las últimas 6 solicitudes recibidas.
  function renderResumen() {
    var hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    var proximas = registros.filter(function (r) {
      var f = fechaLocal(r.fecha);

      return r.tipo === "mesa" && r.estado !== "cancelada" && f && f >= hoy;
    }).sort(function (a, b) {
      return (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
    }).slice(0, 5);

    var recientes = registros.slice().sort(function (a, b) {
      return new Date(b.recibidoEn) - new Date(a.recibidoEn);
    }).slice(0, 6);

    var irCalendario = h("a", { clase: "btn btn--outline", href: "#calendario", texto: "Calendario" });

    contenedor.replaceChildren(
      encabezado("Resumen", "Lo que ha llegado desde los formularios de la web.", irCalendario),

      h("div", { clase: "tarjetas" },
        tarjetaResumen("mesa"), tarjetaResumen("evento"), tarjetaResumen("inscripcion")
      ),

      h("div", { clase: "doble" },
        h("section", { clase: "panel" },
          h("h2", { clase: "panel__titulo", texto: "Próximas reservas de mesa" }),
          proximas.length
            ? h("ul", { clase: "lista-corta" }, proximas.map(filaCorta))
            : h("p", { clase: "vacio", texto: "No hay reservas próximas." })
        ),
        h("section", { clase: "panel" },
          h("h2", { clase: "panel__titulo", texto: "Últimas recibidas" }),
          recientes.length
            ? h("ul", { clase: "lista-corta" }, recientes.map(filaCorta))
            : h("p", { clase: "vacio", texto: "Aún no ha llegado nada." })
        )
      )
    );
  }

  /* -------------------------
     Vista: Calendario
  ------------------------- */

  // Devuelve las solicitudes de un tipo que caen en un día (clave "AAAA-MM-DD").
  // Van ordenadas por hora y luego por nombre; las que no tienen hora quedan al final.
  function delDia(clave, tipo) {
    return registros.filter(function (registro) {
      return registro.tipo === tipo && claveDeRegistro(registro) === clave;
    }).sort(function (a, b) {
      var horaA = a.hora || "99:99";
      var horaB = b.hora || "99:99";

      if (horaA !== horaB) return horaA < horaB ? -1 : 1;

      return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    });
  }

  // Arma la descripción de un día para lectores de pantalla,
  // ej. "jueves, 12 de noviembre de 2026, 2 reservas de mesa, 1 evento".
  function etiquetaDia(fecha, mesas, eventos) {
    var texto = fecha.toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    var extras = [];

    if (mesas) extras.push(mesas === 1 ? "1 reserva de mesa" : mesas + " reservas de mesa");
    if (eventos) extras.push(eventos === 1 ? "1 evento" : eventos + " eventos");
    if (!extras.length) extras.push("sin reservas ni eventos");

    return texto + ", " + extras.join(", ");
  }

  // Título del panel del día seleccionado (ej. "jueves, 12 de noviembre").
  // Solo agrega el año si no es el año actual.
  function tituloDia(clave) {
    var fecha = fechaLocal(clave);

    if (!fecha || isNaN(fecha.getTime())) return clave;

    var opciones = { weekday: "long", day: "numeric", month: "long" };

    if (fecha.getFullYear() !== new Date().getFullYear()) opciones.year = "numeric";

    return fecha.toLocaleDateString("es", opciones);
  }

  // Frase corta con la cantidad de reservas y eventos de un día,
  // o "No hay reservas ni eventos este día." si no hay nada.
  function resumenDia(mesas, eventos) {
    var partes = [];

    if (mesas) partes.push(mesas === 1 ? "1 reserva de mesa" : mesas + " reservas de mesa");
    if (eventos) partes.push(eventos === 1 ? "1 evento" : eventos + " eventos");

    return partes.length ? partes.join(" · ") : "No hay reservas ni eventos este día.";
  }

  // Texto secundario de una fila del panel del día:
  // hora y personas si es mesa, o tipo de evento e invitados si es evento.
  function textoDia(registro) {
    if (registro.tipo === "mesa") {
      return [registro.hora, vacio(registro.personas) ? "" : registro.personas + " pers."].filter(Boolean).join(" · ");
    }

    return [registro.tipoEvento, vacio(registro.invitados) ? "" : registro.invitados + " invitados"].filter(Boolean).join(" · ");
  }

  // Crea una fila clicable del panel del día con el nombre, el detalle corto y el estado.
  // Al hacer clic abre el detalle.
  function filaDia(registro) {
    var boton = h("button", { type: "button", clase: "lista-corta__item" },
      h("span", { clase: "lista-corta__quien" },
        h("strong", { texto: registro.nombre }),
        h("span", { texto: textoDia(registro) || VISTAS[registro.tipo].etiqueta })
      ),
      insignia(registro.estado)
    );

    boton.addEventListener("click", function () { abrirDetalle(registro); });

    return h("li", {}, boton);
  }

  // Crea un bloque del panel del día ("Reservas de mesa" o "Eventos") con su lista,
  // o con un mensaje si no hay nada ese día.
  function bloqueDia(titulo, vacioTexto, items) {
    return h("section", { clase: "dia-panel__bloque" },
      h("h3", { clase: "panel__titulo", texto: titulo }),
      items.length
        ? h("ul", { clase: "lista-corta" }, items.map(filaDia))
        : h("p", { clase: "vacio", texto: vacioTexto })
    );
  }

  // Crea el botón de un día del calendario: el número, los puntos de color (mesa y/o evento)
  // y las marcas de "hoy", "seleccionado" y "de otro mes". Al hacer clic selecciona ese día.
  function botonDia(fecha) {
    var clave = claveDesdeDate(fecha);
    var mesas = delDia(clave, "mesa");
    var eventos = delDia(clave, "evento");
    var clases = ["cal__dia"];

    if (fecha.getMonth() !== calendario.mes) clases.push("cal__dia--otro");
    if (clave === claveDesdeDate(new Date())) clases.push("cal__dia--hoy");
    if (clave === calendario.seleccion) clases.push("cal__dia--activo");

    var boton = h("button", {
      type: "button",
      clase: clases.join(" "),
      "aria-pressed": clave === calendario.seleccion ? "true" : "false",
      "aria-label": etiquetaDia(fecha, mesas.length, eventos.length),
    },
      h("span", { clase: "cal__numero", texto: String(fecha.getDate()) }),
      h("span", { clase: "cal__marcas", "aria-hidden": "true" },
        mesas.length ? h("span", { clase: "cal__punto cal__punto--mesa" }) : null,
        eventos.length ? h("span", { clase: "cal__punto cal__punto--evento" }) : null
      )
    );

    if (clave === claveDesdeDate(new Date())) boton.setAttribute("aria-current", "date");

    boton.addEventListener("click", function (evento) {
      calendario.anio = fecha.getFullYear();
      calendario.mes = fecha.getMonth();
      calendario.seleccion = clave;
      renderCalendario({ teclado: evento.detail === 0, desplazar: evento.detail !== 0 });
    });

    return boton;
  }

  // Devuelve las 42 fechas (6 semanas) que se dibujan en el calendario del mes que se está viendo,
  // empezando en lunes. Incluye días del mes anterior y del siguiente para completar la cuadrícula.
  function diasDelMes() {
    var primero = new Date(calendario.anio, calendario.mes, 1);
    var diaSemana = primero.getDay();
    var desplazamiento = diaSemana === 0 ? 6 : diaSemana - 1;
    var cursor = new Date(calendario.anio, calendario.mes, 1 - desplazamiento);
    var dias = [];

    for (var i = 0; i < 42; i++) {
      dias.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dias;
  }

  // Dibuja la pantalla "Calendario": la cuadrícula del mes con los botones Anterior / Hoy / Siguiente
  // y, al lado, el panel con las reservas y eventos del día seleccionado.
  // Opciones: teclado = devuelve el foco al día elegido; desplazar = en pantallas pequeñas
  // baja hasta el panel del día.
  function renderCalendario(opciones) {
    var opts = opciones || {};
    var mesas = delDia(calendario.seleccion, "mesa");
    var eventos = delDia(calendario.seleccion, "evento");
    var esHoy = calendario.seleccion === claveDesdeDate(new Date());

    var anterior = h("button", { type: "button", clase: "btn btn--small", texto: "Anterior" });
    var siguiente = h("button", { type: "button", clase: "btn btn--small", texto: "Siguiente" });
    var hoy = h("button", { type: "button", clase: "btn btn--small", texto: "Hoy" });

    anterior.setAttribute("aria-label", "Mes anterior");
    siguiente.setAttribute("aria-label", "Mes siguiente");

    anterior.addEventListener("click", function () {
      var fecha = new Date(calendario.anio, calendario.mes - 1, 1);
      calendario.anio = fecha.getFullYear();
      calendario.mes = fecha.getMonth();
      renderCalendario();
    });

    siguiente.addEventListener("click", function () {
      var fecha = new Date(calendario.anio, calendario.mes + 1, 1);
      calendario.anio = fecha.getFullYear();
      calendario.mes = fecha.getMonth();
      renderCalendario();
    });

    hoy.addEventListener("click", function () {
      var fecha = new Date();
      calendario.anio = fecha.getFullYear();
      calendario.mes = fecha.getMonth();
      calendario.seleccion = claveDesdeDate(fecha);
      renderCalendario({ desplazar: true });
    });

    contenedor.replaceChildren(
      encabezado("Calendario", "Reservas de mesa y solicitudes de evento, día por día."),

      h("div", { clase: "cal-layout" },
        h("div", { clase: "cal" },
          h("div", { clase: "cal__nav" },
            h("h2", { clase: "cal__mes", id: "cal-mes", texto: MESES[calendario.mes] + " " + calendario.anio }),
            h("div", { clase: "cal__nav-acciones" }, anterior, hoy, siguiente)
          ),
          h("div", { clase: "cal__nombres" }, DIAS_CORTOS.map(function (dia) {
            return h("span", { clase: "cal__nombre", texto: dia });
          })),
          h("div", { clase: "cal__dias", role: "group", "aria-labelledby": "cal-mes" }, diasDelMes().map(botonDia)),
          h("div", { clase: "cal__leyenda" },
            h("span", {}, h("span", { clase: "cal__punto cal__punto--mesa", "aria-hidden": "true" }), "Reserva de mesa"),
            h("span", {}, h("span", { clase: "cal__punto cal__punto--evento", "aria-hidden": "true" }), "Evento")
          )
        ),

        h("section", { clase: "dia-panel", id: "dia-seleccionado", "aria-labelledby": "dia-titulo" },
          h("span", { clase: "eyebrow eyebrow--terracotta", texto: esHoy ? "Hoy" : "Día seleccionado" }),
          h("h2", { clase: "dia-panel__fecha", id: "dia-titulo", texto: tituloDia(calendario.seleccion) }),
          h("p", { clase: "dia-panel__resumen", texto: resumenDia(mesas.length, eventos.length) }),
          bloqueDia("Reservas de mesa", "No hay reservas de mesa.", mesas),
          bloqueDia("Eventos", "No hay eventos.", eventos)
        )
      )
    );

    if (opts.teclado) {
      var activo = contenedor.querySelector(".cal__dia--activo");

      if (activo) activo.focus();
    } else if (opts.desplazar && window.matchMedia("(max-width: 899px)").matches) {
      var panel = document.getElementById("dia-seleccionado");

      if (panel) {
        var reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        panel.scrollIntoView({ behavior: reducir ? "auto" : "smooth", block: "start" });
      }
    }
  }

  /* -------------------------
     Vista: lista (mesa / evento / inscripción)
  ------------------------- */

  // Crea el encabezado de cada pantalla: título, descripción, un botón extra (opcional)
  // y el botón "Actualizar", que vuelve a leer los datos de Firestore.
  function encabezado(titulo, descripcion, extra) {
    var botonActualizar = h("button", { type: "button", clase: "btn btn--outline", texto: "Actualizar" });

    botonActualizar.addEventListener("click", function () {
      cargar(true);
    });

    return h("div", { clase: "encabezado" },
      h("div", {},
        h("h1", { clase: "encabezado__titulo", texto: titulo }),
        h("p", { clase: "encabezado__texto", texto: descripcion })
      ),
      h("div", { clase: "encabezado__acciones" }, extra || null, botonActualizar)
    );
  }

  // Dice si una solicitud coincide con lo escrito en el buscador (en nombre, correo o teléfono,
  // sin importar mayúsculas). Si el buscador está vacío, todas coinciden.
  function coincideBusqueda(registro) {
    var texto = filtros.busqueda.trim().toLowerCase();

    if (!texto) return true;

    return [registro.nombre, registro.correo, registro.telefono].some(function (campo) {
      return String(campo || "").toLowerCase().indexOf(texto) !== -1;
    });
  }

  // Rellena la tabla de la lista actual: aplica el filtro de estado y la búsqueda, ordena de la más
  // reciente a la más antigua y actualiza el contador de resultados.
  // Solo repinta las filas, no toda la pantalla (por eso no se pierde el foco al escribir).
  function pintarTabla() {
    var vista = VISTAS[vistaActual];

    var filas = registros.filter(function (r) {
      return r.tipo === vistaActual && (!filtros.estado || r.estado === filtros.estado) && coincideBusqueda(r);
    }).sort(function (a, b) {
      return new Date(b.recibidoEn) - new Date(a.recibidoEn);
    });

    contador.textContent = filas.length === 1 ? "1 resultado" : filas.length + " resultados";

    if (!filas.length) {
      cuerpoTabla.replaceChildren(
        h("tr", {}, h("td", { clase: "vacio", colspan: String(vista.columnas.length + 3), texto: "No hay registros con esos filtros." }))
      );
      return;
    }

    cuerpoTabla.replaceChildren.apply(cuerpoTabla, filas.map(function (registro) {
      var celdas = vista.columnas.map(function (col) {
        return h("td", { "data-label": col[1], texto: valorVisible(col[0], registro) });
      });

      var boton = h("button", { type: "button", clase: "btn btn--small", texto: "Ver detalle" });
      boton.setAttribute("aria-label", "Ver detalle de " + registro.nombre);
      boton.addEventListener("click", function () { abrirDetalle(registro); });

      return h("tr", {},
        celdas[0],
        h("td", { "data-label": "Recibida", texto: formatearRecibido(registro.recibidoEn) }),
        celdas.slice(1),
        h("td", { "data-label": "Estado" }, insignia(registro.estado)),
        h("td", { clase: "tabla__accion" }, boton)
      );
    }));
  }

  // Dibuja una pantalla de lista (mesa, evento o inscripción): buscador, filtro de estado,
  // contador y tabla. Las columnas salen de VISTAS.
  function renderLista(tipo) {
    var vista = VISTAS[tipo];

    var buscador = h("input", { type: "search", id: "buscar", placeholder: "Nombre, correo o teléfono", autocomplete: "off" });
    var selector = h("select", { id: "filtro-estado" },
      h("option", { value: "", texto: "Todos" }),
      h("option", { value: "pendiente", texto: "Pendientes" }),
      h("option", { value: "confirmada", texto: "Confirmadas" }),
      h("option", { value: "cancelada", texto: "Canceladas" })
    );

    buscador.value = filtros.busqueda;
    selector.value = filtros.estado;

    buscador.addEventListener("input", function () { filtros.busqueda = buscador.value; pintarTabla(); });
    selector.addEventListener("change", function () { filtros.estado = selector.value; pintarTabla(); });

    contador = h("p", { clase: "herramientas__contador", role: "status", "aria-live": "polite" });
    cuerpoTabla = h("tbody", {});

    var encabezados = [h("th", { scope: "col", texto: vista.columnas[0][1] }), h("th", { scope: "col", texto: "Recibida" })]
      .concat(vista.columnas.slice(1).map(function (col) { return h("th", { scope: "col", texto: col[1] }); }))
      .concat([h("th", { scope: "col", texto: "Estado" }), h("th", { scope: "col" }, h("span", { clase: "solo-lectores", texto: "Acciones" }))]);

    contenedor.replaceChildren(
      encabezado(vista.titulo, vista.descripcion),

      h("div", { clase: "herramientas" },
        h("div", { clase: "campo" }, h("label", { for: "buscar", texto: "Buscar" }), buscador),
        h("div", { clase: "campo" }, h("label", { for: "filtro-estado", texto: "Estado" }), selector),
        contador
      ),

      h("div", { clase: "tabla-caja" },
        h("table", { clase: "tabla" },
          h("thead", {}, h("tr", {}, encabezados)),
          cuerpoTabla
        )
      )
    );

    pintarTabla();
  }

  /* -------------------------
     Detalle
  ------------------------- */

  // Crea un botón del detalle que, al hacer clic, cambia la solicitud al estado indicado.
  function botonAccion(texto, clase, nuevoEstado) {
    var boton = h("button", { type: "button", clase: "btn " + clase, texto: texto });

    boton.addEventListener("click", function () { cambiarEstado(nuevoEstado, boton); });

    return boton;
  }

  // Convierte el teléfono en un enlace para llamar (tel:) y el correo en un enlace para escribir (mailto:).
  // Para cualquier otro campo devuelve null.
  function enlaceContacto(clave, valor) {
    if (clave === "telefono") {
      var digitos = String(valor).replace(/[^\d+]/g, "");

      return h("a", { href: "tel:" + digitos, texto: valor });
    }

    if (clave === "correo") return h("a", { href: "mailto:" + valor, texto: valor });

    return null;
  }

  // Abre la ventana con el detalle de una solicitud: escribe sus datos, decide qué botones de acción
  // mostrar según su estado actual y abre el diálogo.
  function abrirDetalle(registro) {
    var vista = VISTAS[registro.tipo];

    registroAbierto = registro;

    document.getElementById("detalle-tipo").textContent = vista.etiqueta;
    document.getElementById("detalle-titulo").textContent = registro.nombre;
    document.getElementById("detalle-meta").textContent = "Recibida: " + formatearRecibido(registro.recibidoEn);
    document.getElementById("detalle-estado").replaceChildren(insignia(registro.estado));

    document.getElementById("detalle-lista").replaceChildren.apply(
      document.getElementById("detalle-lista"),
      vista.detalle.filter(function (campo) { return campo[0] !== "nombre"; }).map(function (campo) {
        var valor = registro[campo[0]];
        var contenido = vacio(valor)
          ? h("span", { clase: "detalle__vacio", texto: "Sin información" })
          : (enlaceContacto(campo[0], valor) || h("span", { texto: campo[0] === "fecha" ? formatearFecha(valor) : String(valor) }));

        return h("div", { clase: "detalle__fila" }, h("dt", { texto: campo[1] }), h("dd", {}, contenido));
      })
    );

    var acciones = [];

    if (registro.estado !== "confirmada") acciones.push(botonAccion("Confirmar", "btn--green", "confirmada"));
    if (registro.estado !== "pendiente") acciones.push(botonAccion("Volver a pendiente", "btn--outline", "pendiente"));
    if (registro.estado !== "cancelada") acciones.push(botonAccion("Cancelar", "btn--danger", "cancelada"));

    acciones.push(botonEliminar());

    document.getElementById("detalle-acciones").replaceChildren.apply(document.getElementById("detalle-acciones"), acciones);

    if (!dialogo.open) dialogo.showModal();
  }

  // Crea el botón "Eliminar". Pide confirmación en dos pasos para evitar borrados por accidente:
  // el primer clic cambia el botón a "Sí, eliminar para siempre" (y aparece "No, conservar"),
  // el segundo borra de forma permanente.
  function botonEliminar() {
    var boton = h("button", { type: "button", clase: "btn btn--outline", texto: "Eliminar" });
    var cancelar = h("button", { type: "button", clase: "btn btn--outline", texto: "No, conservar" });
    var contenedor = h("span", { clase: "detalle__eliminar" }, boton);

    cancelar.hidden = true;
    contenedor.appendChild(cancelar);

    boton.addEventListener("click", function () {
      if (cancelar.hidden) {
        boton.textContent = "Sí, eliminar para siempre";
        boton.classList.replace("btn--outline", "btn--danger");
        cancelar.hidden = false;
        return;
      }

      eliminarRegistro(boton);
    });

    cancelar.addEventListener("click", function () {
      boton.textContent = "Eliminar";
      boton.classList.replace("btn--danger", "btn--outline");
      cancelar.hidden = true;
    });

    return contenedor;
  }

  // Borra de Firestore la solicitud abierta. Si sale bien, la quita de la lista, cierra el detalle y avisa.
  // Si falla, vuelve a activar el botón y muestra un aviso de error.
  async function eliminarRegistro(boton) {
    if (!registroAbierto) return;

    var id = registroAbierto.id;
    var nombre = registroAbierto.nombre;

    boton.disabled = true;

    try {
      await window.MuscariDatos.eliminar(id);

      registros = registros.filter(function (r) { return r.id !== id; });

      dialogo.close();
      mostrarAviso("Solicitud de " + nombre + " eliminada.");
      actualizarInsignias();
      render();
    } catch (error) {
      boton.disabled = false;
      mostrarAviso("No se pudo eliminar. Intenta de nuevo.");
    }
  }

  // Cambia en Firestore el estado de la solicitud abierta. Si sale bien, lo actualiza en la lista,
  // cierra el detalle y avisa. Si falla, vuelve a activar el botón y muestra un aviso de error.
  async function cambiarEstado(nuevoEstado, boton) {
    if (!registroAbierto) return;

    var id = registroAbierto.id;
    var nombre = registroAbierto.nombre;

    boton.disabled = true;

    try {
      await window.MuscariDatos.actualizarEstado(id, nuevoEstado);

      registros.forEach(function (r) {
        if (r.id === id) r.estado = nuevoEstado;
      });

      dialogo.close();
      mostrarAviso(nombre + ": " + ESTADOS[nuevoEstado].toLowerCase() + ".");
      actualizarInsignias();
      render();
    } catch (error) {
      boton.disabled = false;
      mostrarAviso("No se pudo guardar el cambio. Intenta de nuevo.");
    }
  }

  /* -------------------------
     Navegación y carga
  ------------------------- */

  // Lee la parte # de la dirección (ej. #mesa) para saber qué pantalla mostrar.
  // Si no es una pantalla válida, usa "resumen".
  function vistaDesdeHash() {
    var nombre = window.location.hash.replace("#", "");

    return nombre === "resumen" || nombre === "calendario" || VISTAS[nombre] ? nombre : "resumen";
  }

  // Marca en el menú lateral el enlace de la pantalla actual (aria-current)
  // y se lo quita a los demás.
  function marcarNavegacion(vista) {
    document.querySelectorAll(".sidebar__link").forEach(function (enlace) {
      if (enlace.getAttribute("data-vista") === vista) enlace.setAttribute("aria-current", "page");
      else enlace.removeAttribute("aria-current");
    });
  }

  // Dibuja la pantalla que corresponde a la dirección actual (resumen, calendario o una lista).
  // Si cambió de pantalla, reinicia los filtros. Usa los datos que ya están en memoria.
  function render() {
    var vista = vistaDesdeHash();

    if (vista !== vistaActual) {
      vistaActual = vista;
      filtros = { busqueda: "", estado: "" };
    }

    marcarNavegacion(vista);
    document.title = (vista === "resumen" ? "Resumen" : vista === "calendario" ? "Calendario" : VISTAS[vista].titulo) + " — Consola Muscari";

    if (vista === "resumen") renderResumen();
    else if (vista === "calendario") renderCalendario();
    else renderLista(vista);
  }

  // Muestra "Cargando solicitudes…" en lugar del contenido.
  function mostrarCargando() {
    contenedor.replaceChildren(h("p", { clase: "cargando", role: "status", texto: "Cargando solicitudes…" }));
  }

  // Muestra el mensaje de que no se pudieron cargar las solicitudes, con un botón "Reintentar".
  function mostrarError() {
    var reintentar = h("button", { type: "button", clase: "btn btn--dark", texto: "Reintentar" });

    reintentar.addEventListener("click", function () { cargar(true); });

    contenedor.replaceChildren(
      h("div", { clase: "error-caja", role: "alert" },
        h("p", { texto: "No pudimos cargar las solicitudes." }),
        reintentar
      )
    );
  }

  // Pide las solicitudes a Firestore, las guarda en memoria y redibuja la pantalla.
  // Si falla, muestra el error. Con conIndicador = true muestra "Cargando…" antes de pedirlas.
  async function cargar(conIndicador) {
    if (conIndicador) mostrarCargando();

    try {
      registros = await window.MuscariDatos.listar();
      actualizarInsignias();
      render();
    } catch (error) {
      mostrarError();
    }
  }

  /* -------------------------
     Arranque
  ------------------------- */

  document.getElementById("usuario-activo").textContent = window.MuscariAuth.usuario();
  document.getElementById("btn-salir").addEventListener("click", window.MuscariAuth.cerrarSesion);
  document.getElementById("detalle-cerrar").addEventListener("click", function () { dialogo.close(); });
  document.getElementById("banner-demo").hidden = !window.MuscariDatos.simulando;

  // Cerrar el detalle al hacer clic fuera de la tarjeta.
  dialogo.addEventListener("click", function (evento) {
    if (evento.target === dialogo) dialogo.close();
  });

  window.addEventListener("hashchange", function () {
    render();
    document.getElementById("contenido").focus({ preventScroll: true });
  });

  mostrarCargando();
  cargar(false);
})();
