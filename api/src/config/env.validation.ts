import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4001),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(process.env.NODE_ENV === 'production' ? 32 : 8).required(),
  CORS_ORIGINS: Joi.string().optional(),
  // Notificaciones push (Web Push). Sin estas llaves la app funciona, pero no envia push.
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
  VAPID_SUBJECT: Joi.string().allow('').optional(),
  /** Coach semanal con Claude (opcional: sin ella el coach queda apagado). */
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
  // Avisos por correo (SMTP de Hostinger, el mismo buzon del booking). Sin SMTP_USER y SMTP_PASS queda apagado.
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_SECURE: Joi.boolean().optional(),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  MAIL_FROM: Joi.string().allow('').optional(),
  /** Direccion publica de la app, para los enlaces de los correos y de WhatsApp. */
  APP_URL: Joi.string().allow('').optional(),
  // Avisos por WhatsApp: el servicio wa (celular vinculado). Sin WA_TOKEN queda apagado.
  WA_URL: Joi.string().allow('').optional(),
  WA_TOKEN: Joi.string().allow('').optional(),
});
