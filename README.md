# Vectorizador de Bordados

Herramienta web que convierte un logo (PNG, JPG o WebP) en un **SVG listo para bordar**:

- quita el fondo,
- separa la imagen en colores de hilo,
- borra motitas, líneas demasiado finas y tonos de borde,
- recorta cada color para que **ninguna pieza quede debajo de otra** (no hay hilo sobre hilo),
- exporta el SVG con su tamaño real en milímetros y una capa de Inkscape por color, en el orden sugerido para bordar.

Todo corre en el navegador. La imagen no se sube a ningún lado y no usa inteligencia artificial: es un algoritmo, así que la misma imagen con los mismos ajustes da siempre el mismo resultado.

## Cómo usarlo

1. Abrí `index.html` en el navegador (doble clic alcanza, no hace falta instalar nada).
2. Arrastrá la imagen, elegila con el botón o pegala con Ctrl+V.
3. Poné el **ancho del bordado** en milímetros.
4. Revisá la lista de **Hilos**:
   - tocá el carretel para cambiar el color,
   - si dos tonos tienen que ir con el mismo hilo (por ejemplo, un amarillo y su sombra), elegí «Unir con…»,
   - «No bordar» saca ese color del diseño.
5. Si queda alguna pieza que no querés, tocala en la vista previa: se rellena con el color de al lado (o queda hueca, según el modo elegido). «Deshacer» vuelve atrás.
6. Descargá el SVG.

### Ajustes

| Ajuste | Qué hace |
| --- | --- |
| Ancho del bordado | Tamaño real del SVG. También define qué tan chico es un «detalle». |
| Colores | Automático, o un número fijo de colores. |
| Quitar el fondo | Borra el color que toca los bordes de la imagen y todo lo conectado a él. |
| Detalle mínimo | Elimina partes más finas que este valor (en mm). Si desaparecen letras, bajalo. |
| Suavizado de bordes | Cuánto se redondean los contornos. |
| Calidad del trazado | Resolución de trabajo: 1200, 1600 o 2400 px. |

## Del SVG a la bordadora

El SVG tiene formas, no puntadas. Para generar el archivo de la máquina (`.xxx`, `.dst`, `.pes`, `.jef`, etc.) se puede usar [Ink/Stitch](https://inkstitch.org), una extensión gratuita de Inkscape:

1. Abrí el SVG en Inkscape.
2. Ajustá las puntadas en **Extensiones › Ink/Stitch › Parámetros**. Las partes de menos de 1 mm de ancho conviene bordarlas en satén.
3. Revisá el resultado con el simulador.
4. **Archivo › Guardar una copia** y elegí el formato de tu máquina.

## Cómo funciona

1. **Colores**: agrupa los píxeles con k-means en espacio Lab (dándole menos peso a la luminosidad, para que las sombras pesen menos que el tono) y une los tonos casi iguales y las sombras del mismo matiz.
2. **Tonos de borde**: detecta los colores que solo existen en los bordes (mezclas de antialiasing o desenfoque) y reparte esos píxeles entre los colores vecinos.
3. **Fondo**: toma el color dominante en el borde de la imagen y borra la región conectada a él.
4. **Limpieza**: suavizado por mayoría ponderada, apertura morfológica por color (borra lo más fino que el detalle mínimo) y unión de manchas chicas al vecino con el que comparten más borde.
5. **Trazado**: recorre el contorno de cada pieza sobre la grilla de píxeles. Cada borde entre dos piezas se suaviza y se convierte en curvas **una sola vez** y lo usan las dos piezas, así que entre colores no quedan huecos ni superposiciones.

## Desarrollo

El código está en `src/`:

- `src/engine.js`: el motor (colores, limpieza y trazado). No tiene dependencias.
- `src/ui.html`: la interfaz.

`index.html` se genera juntando los dos:

```sh
python3 build.py
```
