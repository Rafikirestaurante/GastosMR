export function conTiempoMaximo(promise, ms, nombreOperacion) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = window.setTimeout(() => {
      reject(new Error(`${nombreOperacion} tardó demasiado. Revisa la conexión o Supabase.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timerId) window.clearTimeout(timerId);
  });
}
