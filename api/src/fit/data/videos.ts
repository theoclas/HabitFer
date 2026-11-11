/*
 * Videos de YouTube en español para los ejercicios y rutinas que más lo necesitan. Se ven con el reproductor oficial
 * de YouTube en su modo de privacidad (no se bajan ni se copian). Cada uno se revisó con oEmbed (11 nov 2026): existe
 * y deja verse dentro de otras páginas. Si alguno se cae, la persona puede pegar otro en el ejercicio.
 * El título es una descripción corta nuestra; el canal es el nombre exacto en YouTube.
 */

export type CuratedVideo = { id: string; title: string; channel: string; start?: number };

/** Por clave de ejercicio. */
export const EXERCISE_VIDEOS: Record<string, CuratedVideo> = {
  sentadilla: { id: 'shS8An5KOkg', title: 'Cinco consejos para una buena sentadilla', channel: 'Fausto Murillo' },
  'sentadilla-silla': { id: 'xXKExFcbGzg', title: 'Sentadilla con silla sin lastimar las rodillas', channel: 'Mariana Quevedo | Fisioterapia Querétaro' },
  'zancada-atras': { id: 'zDN7X4oefgY', title: 'Zancada hacia atrás en cuatro pasos', channel: 'APTA Vital Sport' },
  flexion: { id: 'e_EKkqoHxns', title: 'Flexiones desde cero, paso a paso', channel: 'Patricio Almirón' },
  'plancha-antebrazos': { id: 'zfY5XXa26ug', title: 'La plancha sin dañar la espalda', channel: 'Marcos Sacristán | Fisioterapia a tu alcance' },
  'puente-gluteo': { id: 'xGzXTn4o0wE', title: 'Puente de glúteo paso a paso', channel: 'Deportika Online' },
  'peso-muerto-rumano': { id: 'yxLk9X5C7RU', title: 'Peso muerto rumano con mancuernas, sin dolor de espalda', channel: 'DrVíctorLópez' },
  'remo-mancuerna': { id: 'radVWm-e81I', title: 'Remo inclinado con mancuernas', channel: 'DrVíctorLópez' },
  'bicho-muerto': { id: '2_2RPDMA_aw', title: 'Bicho muerto, versión sencilla', channel: 'Clínicas Diego de León' },
  'perro-pajaro': { id: 'NB8imx0YJVY', title: 'Perro-pájaro paso a paso', channel: 'Deportika Online' },
  'sentadilla-bulgara': { id: 'rLJ9yBuYbIE', title: 'Sentadilla búlgara: dónde poner los pies', channel: 'DrVíctorLópez' },
  'press-hombros': { id: 'Q-Lkv9rlRhY', title: 'Press de hombros con mancuernas', channel: 'Fitness Consciente' },
  'gato-vaca': { id: 'NVNoJph0fw0', title: 'Gato-vaca paso a paso', channel: 'Happy Yoga Sangha' },
  'triceps-silla': { id: 'jtPflZ0-pFs', title: 'Fondos de tríceps en una silla', channel: 'Christian Smith' },
  escaladores: { id: 'SMs2N1_ce7g', title: 'Escaladores paso a paso para empezar', channel: 'Javier Giménez - Healthy Fitness' },
};

/** Por clave de rutina lista (videos para seguir de principio a fin). */
export const ROUTINE_VIDEOS: Record<string, CuratedVideo> = {
  'empieza-aqui': { id: 'xZo7q1Wok0U', title: 'Cardio sin saltos para empezar (20 min)', channel: 'Jsentrenadorpersonal' },
  'yoga-suave': { id: '5JR8GoLSn8k', title: 'Clase de yoga suave para principiantes (17 min)', channel: 'Brenda Medina YOGA' },
  'caminata-en-casa': { id: 'SOUVx8oFL88', title: 'Caminata rápida en casa (20 min)', channel: 'Sergio Orduz' },
  'estirar-al-final': { id: '5RgiY6XoKeY', title: 'Estiramiento para después de entrenar (8 min)', channel: 'Chuy Almada' },
};
