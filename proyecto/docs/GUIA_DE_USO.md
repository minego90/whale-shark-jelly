# Guía de uso — todo lo que se puede hacer (v36)

Página: https://minego90.github.io/whale-shark-jelly/ · la versión se ve abajo del panel ("Build v36 - …Z").

## 1. En PC (Chrome con WebGPU)

**Ratón**
- **Clic izquierdo + arrastrar sobre el tiburón**: lo agarras del punto donde hiciste clic y lo estiras/jalas (gel). Al soltar, rebota.
- **Clic izquierdo + arrastrar sobre una medusa**: la agarras y la mueves; al tocarla sale la onda de color.
- **Clic sobre el krill grande (Follow my food)**: lo agarras y lo pones donde quieras; el tiburón lo persigue.
- **Arrastrar sobre una mata de kelp**: la reubicas en el piso.
- **Arrastrar en el vacío**: gira la cámara (órbita). **Rueda**: acercar/alejar.
- **Torcer al agarrar**: Shift + arrastrar, o clic derecho, o la casilla "Twist pointer".

**Botones del panel**
| Botón | Qué hace |
|---|---|
| Ocean / Lagoon / Dusk / Coral | Paleta de color del gel |
| Gulp | El tiburón abre la boca y traga |
| Swish tail | La cola se mueve (interruptor). Con Swim apagado, las medusas pulsan en su sitio mientras esté activo |
| Light up | Bioluminiscencia (escena oscura, brillos) |
| Ocean gravity | Gravedad baja + arrastre de agua: el tiburón flota |
| Swim | El tiburón nada solo; las medusas despiertan y pasean por todo el plato. Al apagarlo las medusas se quedan quietas donde estén |
| Follow my food | Aparece un krill grande de vez en cuando; el tiburón lo persigue y se lo come; lo puedes agarrar y moverlo |
| Jellyfish | Mostrar/ocultar las 3 medusas |
| Underwater blue | Fondo azulado de "bajo el agua" (en AR: velo azul leve sobre tu cuarto) |
| Light rays | Cáusticas: líneas de luz del agua sobre piso, tiburón, kelp y medusas |
| Scatter krill | Interruptor: suelta 60 krill; cuando se los come casi todos, suelta otra tanda (35–49) |
| Reset | Todo vuelve al inicio (medusas al piso) |

**Sliders / casillas**: Firmness (dureza del gel, también medusas), Damping (cuánto se calma el bamboleo, también medusas), Ocean sound (volumen del ambiente), Lattice detail (resolución de la simulación), ¼ speed, Show mesh (ver el lattice), Pause, Twist pointer, Seaweed (kelp sí/no).

## 2. En Meta Quest 3/3S (Quest Browser)

**Entrar**: botón "Place in your room (AR)" (passthrough) o "Enter VR". Permitir manos y, en AR, el permiso de espacio (para paredes reales).

**Colocar (solo AR)**: apunta a una mesa o al piso → el tiburón sigue el puntero → **pinch** (o gatillo) para soltarlo ahí. En el panel puedes cambiar tamaño (Size) y girar (Turn) antes. Luego "Move shark" vuelve a este modo.

**Manos (hand-tracking)**
- **Pinch cerca del tiburón**: lo agarras de ese punto y lo jalas; con **dos manos** a la vez lo estiras de dos lados.
- **Pinch lejos**: el rayo guía sale de la mano; pinch sobre el tiburón/medusa/krill grande lo agarra a distancia.
- **Tocar/empujar sin pinch**: tu mano completa colisiona (≈45 esferas por mano: cada articulación, entre articulaciones, palma) y también la **cabeza**. Empujas el tiburón, las medusas (campana, tentáculos y brazos) y el krill. Toques rápidos con un dedo ya no atraviesan las medusas.
- **Medusas**: al tocarlas → onda de color aguamarina/rosada que recorre la campana y los tentáculos y vuelve a su color en ~2 s. Las puedes agarrar con pinch y lanzarlas: chocan con paredes y techo.
- **Kelp**: pinch en la base de una mata y arrástrala por el piso.
- **Controles (mandos)**: rayo + gatillo hacen lo mismo que el pinch.

**Panel de vidrio flotante**
- **Tocar con el dedo**: acerca el índice; el botón se ilumina a ~5 cm y se presiona al tocar el vidrio (una vez por toque).
- **Rayo + pinch**: también presiona botones y los "–/+" de los sliders.
- **Mover el panel**: pinch sobre la **barra de abajo** (o el título) y llévalo; o con el rayo + pinch sobre la barra/título.
- Tiene los mismos botones que en PC + Size, Turn, Move shark (AR), Exit. Abajo: diagnóstico (frames, "walls N" = paredes reales detectadas; 0–1 = cuarto virtual).
- Segundo panel de información (lecturas: masa, volumen, apertura de boca, krill comido).

**Paredes y techo**: en AR se usan los planos reales del cuarto (de la configuración de espacio del Quest); si no hay, un cuarto invisible (~2.2 m de radio, ~2.5 m de alto). En VR y PC también hay límites invisibles. Nada se va al infinito.

## 3. Comportamientos automáticos
- **Tiburón**: en el piso, si queda de lado/boca arriba, a los 2 s da un saltico y se endereza; nadando se endereza solo y cabecea hacia arriba/abajo al subir o bajar. Caza krill cercano y el krill grande.
- **Medusas**: flácidas en el piso hasta el primer Swim; nadando pulsan, eligen puntos al azar lejos de las otras (nunca se juntan), flotación casi neutra; al apagar Swim se quedan donde están.
- **Krill**: nadan en grupo, huyen de las manos, el tiburón se los come (contador "krill eaten").
