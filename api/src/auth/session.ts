/**
 * Cuánto dura la sesión: un año. La app la renueva sola cada vez que se abre (POST /auth/renew),
 * así que solo hay que volver a entrar si pasa un año sin abrirla o si se cierra la sesión.
 * Es un proyecto personal: se prefiere no pedir la contraseña a cada rato. Suspender una cuenta
 * la corta de una vez, porque la estrategia JWT revisa el estado del usuario en cada pedido.
 */
export const SESSION_DAYS = 365;
export const SESSION_TTL_SECONDS = SESSION_DAYS * 24 * 60 * 60;
export const SESSION_MAX_AGE_MS = SESSION_TTL_SECONDS * 1000;
