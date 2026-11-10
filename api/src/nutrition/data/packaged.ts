/**
 * Empacados que más se compran en Colombia, por código de barras, para que salgan en la búsqueda
 * normal sin tener que escanearlos. Aquí va solo el código y el nombre con que se muestra (el de
 * Open Food Facts suele venir desordenado: «Nutella FerreroNutella»): los valores los trae el
 * cargador (seed-packaged) de Open Food Facts, una base abierta (licencia ODbL), y se revisan igual
 * que al escanear (si las calorías no cuadran con los macros, no entran).
 *
 * Lista armada el 10 nov 2026 con los productos de Colombia en Open Food Facts que traen la tabla
 * completa. Se dejaron por fuera los que tenían los valores de una porción puestos como si fueran
 * de 100 g (Milo de 250 g con 80 kcal, chocolatina Jet con 130, avena Quaker con 90…).
 */
export type PackagedRef = { code: string; name: string };

export const PACKAGED: PackagedRef[] = [
  // Galletas
  { code: '7590011251100', name: 'Galletas Oreo' },
  { code: '7702133006661', name: 'Galletas Oreo cookies and cream' },
  { code: '7622210633842', name: 'Mini Oreo' },
  { code: '7702025113132', name: 'Galletas Ducales' },
  { code: '7702025140367', name: 'Galletas Saltín Noel tradicional' },
  { code: '7702025189243', name: 'Galletas Saltín Noel integral' },
  { code: '7702025136629', name: 'Galletas Festival de vainilla' },
  { code: '7702025118311', name: 'Galletas de leche Noel' },
  { code: '7702025186921', name: 'Galletas Dux' },
  { code: '7702025103379', name: 'Galletas Tosh de vainilla' },
  { code: '7702025100293', name: 'Galletas Tosh de chocolate' },
  { code: '7750168001687', name: 'Galletas Club Social integral' },
  { code: '7702011270504', name: 'Galletas Crakeñas' },
  // Ponqués y dulces
  { code: '7702914596794', name: 'Chocoramo' },
  { code: '7702914115209', name: 'Gansito' },
  { code: '7702914597982', name: 'Ponqué Gala de vainilla' },
  { code: '7702914598804', name: 'Ponqué Mañana Ramo' },
  { code: '7702914111508', name: 'Ponqué Ramito' },
  { code: '7702914221108', name: 'Achiras Ramo' },
  { code: '7702007224160', name: 'Wafer Jet' },
  { code: '7702007034288', name: 'Cruji Jet' },
  { code: '7702007039689', name: 'Chocolatina Jumbo Flow' },
  { code: '7702007009989', name: 'Chocolatina Jumbo mix con maní' },
  { code: '7702007061499', name: 'Chocolatina Gol' },
  { code: '7702011012401', name: 'Nucita' },
  { code: '7702011281180', name: 'Bon Bon Bum' },
  { code: '7802225511513', name: 'Bon o Bon' },
  { code: '7702993031292', name: 'Gomitas Trululú aros' },
  { code: '7898024395232', name: 'Nutella' },
  // Paquetes de mecato
  { code: '7702189012494', name: 'Papas Margarita natural' },
  { code: '7702189012531', name: 'Papas Margarita de pollo' },
  { code: '7702189054210', name: 'De Todito BBQ' },
  { code: '7702189045799', name: 'Choclitos de limón' },
  { code: '7702189050175', name: 'Doritos' },
  { code: '7702189057884', name: 'Cheetos Trissitos' },
  { code: '7702189055453', name: 'Natuchips de plátano verde' },
  { code: '7708227055195', name: 'Platanitos verdes' },
  { code: '7702914555104', name: 'Tostacos picantes' },
  { code: '7703133010535', name: 'Yupis' },
  { code: '7703133088121', name: 'Rizadas de tomate Yupi' },
  { code: '7703133021227', name: 'Crispetas Yupi' },
  { code: '0038000184949', name: 'Pringles crema y cebolla' },
  { code: '7702189109996', name: 'Maní Moto' },
  { code: '7702007001303', name: 'Maní con sal La Especial' },
  // Cereales, pan y harinas
  { code: '7702103015020', name: 'Zucaritas' },
  { code: '7702103668349', name: 'Corn Flakes Kellogg’s' },
  { code: '7702103863454', name: 'Choco Krispis' },
  { code: '7702103000262', name: 'Froot Loops' },
  { code: '7702193623389', name: 'Avena en hojuelas Quaker' },
  { code: '7705326073891', name: 'Pan integral Bimbo' },
  { code: '7705326018717', name: 'Tostadas Tostaos Bimbo' },
  { code: '7701008597389', name: 'Arepas de maíz blanco Medalla de Oro' },
  // Lácteos
  { code: '7702129003612', name: 'Leche entera Colanta' },
  { code: '7702177021316', name: 'Leche semidescremada Alquería' },
  { code: '7702177009642', name: 'Leche deslactosada Alquería' },
  { code: '7705436012377', name: 'Bebida de almendras sin azúcar Del Origen' },
  { code: '7702001042012', name: 'Yogurt Alpina' },
  { code: '7702001155439', name: 'Yogurt griego Alpina' },
  { code: '7702001086023', name: 'Bon Yurt con Zucaritas' },
  { code: '7702001047581', name: 'Yogo Yogo de fresa' },
  { code: '7702001048106', name: 'Kumis Alpina' },
  { code: '7702129046381', name: 'Kumis Colanta' },
  { code: '7702129025201', name: 'Queso crema Colanta' },
  { code: '7702001121755', name: 'Queso mozzarella Alpina' },
  // Carnes frías y enlatados
  { code: '7701101247273', name: 'Salchicha Ranchera premium' },
  { code: '7701101261507', name: 'Salchicha para perro Zenú' },
  { code: '7701101240991', name: 'Salchicha viena de pollo Zenú' },
  { code: '7701101358542', name: 'Jamón de cerdo Pietrán' },
  { code: '7702129077279', name: 'Tocineta Colanta' },
  { code: '7702367003917', name: 'Atún en agua Van Camp’s' },
  { code: '7702367000404', name: 'Atún en aceite de oliva Van Camp’s' },
  // Salsas
  { code: '7702047039892', name: 'Mayonesa Fruco' },
  { code: '7702047130308', name: 'Salsa de tomate Fruco' },
  { code: '7702097058867', name: 'Mayonesa La Constancia' },
  // Bebidas
  { code: '7702004013484', name: 'Pony Malta' },
  { code: '7702004013668', name: 'Pony Malta mini' },
  { code: '7702535024447', name: 'Coca-Cola sabor original' },
  { code: '7702535011799', name: 'Coca-Cola sin azúcar' },
  { code: '7702090022766', name: 'Colombiana Postobón' },
  { code: '7702090031928', name: 'Manzana Postobón' },
  { code: '7702090016369', name: 'Hit de frutas tropicales' },
  { code: '7702090029864', name: 'Hit de mango' },
  { code: '7702090029857', name: 'Hit de mora' },
  { code: '7702090027839', name: 'Mr Tea de limón' },
  { code: '7702535014240', name: 'Fuze Tea de limón sin calorías' },
  { code: '7707362390086', name: 'Hatsu Tea de frutos rojos' },
  { code: '7702192218050', name: 'Gatorade de mandarina' },
  { code: '7702192422051', name: 'Gatorade de frutos tropicales' },
  { code: '7702090039436', name: 'Speed Max' },
  { code: '7702354934361', name: 'Vive 100 original' },
  { code: '7702024059561', name: 'Milo listo para tomar' },
  { code: '7702024055105', name: 'Milo en polvo' },
  { code: '7702007216066', name: 'Chocolisto en polvo' },
];
