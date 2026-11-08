import { SetMetadata } from '@nestjs/common';

export const SKIP_ORIGIN_KEY = 'skipOriginCheck';

/**
 * Para rutas que llaman apps (no navegadores) con su propia llave en el encabezado o el cuerpo, como el atajo
 * de iOS: no mandan Origin. El control de Origin protege las sesiones del navegador; una llave propia no se
 * puede usar desde otra página sin conocerla.
 */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_KEY, true);
