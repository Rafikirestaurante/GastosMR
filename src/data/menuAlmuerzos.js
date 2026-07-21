export const VALOR_PARA_LLEVAR = 1500;
export const VALOR_PARA_LLEVAR_DESAYUNO = 1000;
export const MAX_ACOMPANANTES_CLIENTE = 3;
export const INCLUIDOS_FIJOS = "Sopa + bebida incluida";

export const estadosPedido = ["Pendiente", "Finalizado"];

export const menuFallback = {
  id: null,
  fecha: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date()),
  titulo: "Almuerzo ejecutivo Rafiki",
  descripcion: "Escoge tu plato del día y máximo 3 acompañantes. Incluye sopa y bebida.",
  precio: 0,
  proteinas: [],
  proteinas_detalle: [],
  platos_detalle: [],
  acompanantes: [],
  activo: true
};
