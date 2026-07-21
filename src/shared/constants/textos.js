export const BOTONES = {
  CLIENTE_PEDIR: "🛍️ Haz tu pedido aquí",
  ENTRAR_PANEL: "Entrar al panel",
  VOLVER_INICIO: "Volver al inicio",
  CONFIRMAR_WHATSAPP: "🟢 Por favor Confirmar por WhatsApp",
  GUARDAR_ENVIAR_WHATSAPP: "Guardar solicitud y enviar por WhatsApp",
  GUARDANDO_SOLICITUD: "Guardando solicitud...",
  ENVIAR_SELECCIONADOS_WHATSAPP: "Enviar seleccionados por WhatsApp",
};

export const TEXTOS_APP = {
  BIENVENIDA_TITULO: "Bienvenido a Rafiki",
  BIENVENIDA_DESCRIPCION: "Escoge tu almuerzo del día, selecciona tus acompañantes y envíanos tu pedido por WhatsApp.",
  PANEL_ADMIN_MARCA: "🔐 Panel Rafiki",
  PANEL_ADMIN_TITULO: "Acceso administrativo",
  PANEL_ADMIN_DESCRIPCION: "Ingresa la clave para ver pedidos y editar el menú diario.",
  CLAVE_PANEL: "Clave del panel",
  CLAVE_PLACEHOLDER: "Escribe la clave",
  CARGANDO_SECCION: "Cargando sección...",
  CARGANDO_SECCION_DETALLE: "Preparando esta parte de Rafiki Pedidos.",
};

export const MENSAJES_PEDIDOS = {
  MENU_ACTUALIZADO: "Menú actualizado correctamente.",
  MENU_CREADO: "Menú creado correctamente.",
  SIN_PEDIDOS_PENDIENTES: "No hay pedidos pendientes para finalizar.",
};

export const CONFIRMACIONES_PEDIDOS = {
  pedidoEntregado: (codigoPedido) => `¿Confirmas que el pedido #${codigoPedido} ya fue entregado?`,
  finalizarPendientes: (cantidad) => `¿Confirmas finalizar ${cantidad} pedidos pendientes?\n\nTodos pasarán a Pedidos Finalizados.`,
  eliminarPedido: (codigoPedido) => `¿Seguro que deseas mover el pedido #${codigoPedido} a Pedidos Borrados?\n\nDejará de sumar en ventas, pero quedará visible para control.`,
};

export const MENSAJES_INSUMOS = {
  SIN_INSUMOS_PARA_ENVIAR: "No hay insumos pendientes para enviar. Los insumos están marcados como comprados.",
  ABRIR_WHATSAPP_PROVEEDORES: "Se abrirá WhatsApp con el listado para proveedores.",
  LISTA_COMPRAS_REINICIADA: "Lista de compras reiniciada.",
  BORRANDO_SOLICITUDES_DIA: "Borrando solicitudes del día...",
  SOLICITUD_GUARDADA_WHATSAPP: "Solicitud guardada. Se abrirá WhatsApp con el consolidado.",
  SOLICITUD_GUARDADA: "Solicitud guardada. Ahora puedes enviar el consolidado por WhatsApp.",
};

export const CONFIRMACIONES_INSUMOS = {
  limpiarComprados: "¿Quieres desmarcar todos los insumos comprados y borrar las cantidades escritas?",
  borrarSolicitudesDia: (fecha) => `¿Seguro que deseas borrar todas las solicitudes del día ${fecha}? Esta acción no se puede deshacer.`,
  eliminarProductoLista: (nombre) => `¿Eliminar ${nombre} de la lista principal? Esta acción solo afecta esta lista de solicitud.`,
};
