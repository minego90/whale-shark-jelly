# CLAUDE.md — Whale Shark Jelly (notas completas para Claude)

Este archivo es el "cerebro" del proyecto: léelo completo antes de tocar código. Lee también `docs/NOVEDADES_v32-v36.md` (lo último que se mejoró) y `docs/GUIA_DE_USO.md` (todo lo que el usuario puede hacer: agarrar, mover, botones, manos, panel). Resume todo lo que se construyó en la sesión de Claude (nov 7–9, 2026, versiones v1 → v36), cómo está armado, cómo compilar/probar/publicar, las decisiones tomadas y lo que falta.

## 1. Qué es

Estudio interactivo de un **tiburón ballena de gelatina** (soft-body) en el navegador:
- **PC (Chrome)**: WebGPU, mouse para agarrar/arrastrar/empujar el gel, panel lateral de controles.
- **Meta Quest 3/3S (Quest Browser)**: WebXR **AR (passthrough)** y **VR**, manos con pinch, rayo, colisión de manos y cabeza, panel de vidrio flotante.
- Una sola página HTML autocontenida (sin dependencias externas, sin assets externos): `dist/index.html` (~1.17 MB, la mayor parte es el volumen del cuerpo comprimido).

Publicado en GitHub Pages:
- Repo: `minego90/whale-shark-jelly`, rama `main`, archivo raíz `index.html` (= `dist/index.html`).
- URL: https://minego90.github.io/whale-shark-jelly/

## 2. Preferencias del usuario (MUY IMPORTANTE)

- Escribe en **español**; responder en español, directo y claro.
- **Siempre dejar visible un número de versión con fecha/hora** en la página (`#verTag`, "Build vNN - MM-DD_HH:MMZ", también en el panel XR) y **decirle qué build debe ver** al publicar.
- Prueba en **Quest Browser** (Quest 3/3S) y en **PC Chrome**. Reporta con capturas.
- Commits terminan con las líneas de co-autoría que indique el entorno (en la sesión original: `Co-Authored-By: Claude ...` y `Claude-Session: ...`).
- El modelo de referencia del tiburón es **CC BY-NC 4.0** (ver §9): no usar comercialmente (p. ej. clases pagas) sin otro modelo/licencia. El crédito está en la página.

## 3. Estructura de esta carpeta

```
src/
  parts/head.html   HTML + CSS + panel de controles (botones/sliders), #verTag "Build __VER__", crédito CC
  parts/grid.js     volumen del cuerpo horneado (SDF cuantizado, zlib+base64) + gridLoad() (DecompressionStream)
  core.js           FÍSICA y GEOMETRÍA (sin GPU): lattice de tetraedros, XPBD, malla de piel, krill, kelp
  parts/jf.js       MEDUSAS (3) — simulación de gel propia (bordes + volumen + forma objetivo), tentáculos, agarre
  parts/shaders.js  todo el WGSL (un solo módulo): piso, sombras, gel del tiburón, beads, medusas, panel, láser…
  parts/app.js      app: WebGPU init, pipelines, render loop, UI, ratón, XR (puente WebGL), panel VR, sonido hooks
  parts/audio.js    ambiente de océano sintetizado (WebAudio)
  parts/phone.js    modo cámara de teléfono (AR con MediaPipe) — OCULTO desde v15
  build.sh          concatena todo -> ../dist/index.html, pone la versión, chequea sintaxis, genera core_node.js
  VERSION           número de versión actual (36)
(dist/ no va en el repo: el build publicado es /index.html en la raíz)
tests/sim/*.js      pruebas de física en Node (usan src/core_node.js generado por build.sh)
tests/browser/      snap.py (captura headless), xrtest.py (simula sesión XR), cv.sh (atajo de cámara)
tools/bake/         cómo se generó el volumen del cuerpo desde el modelo glTF
reference/          imágenes de referencia que mandó el usuario, licencia del modelo, vistas del modelo
docs/               HISTORIAL.md, NOVEDADES_v32-v36.md, GUIA_DE_USO.md, capturas
```

Orden de concatenación (importa, todo es un `<script type="module">`):
`grid.js, core.js, jf.js, shaders.js, app.js, audio.js, phone.js`.

## 4. Compilar, probar, publicar

```bash
cd src
echo 37 > VERSION          # subir versión al publicar
./build.sh                 # -> dist/index.html, imprime SYNTAX_OK y la versión
node ../tests/sim/tjf.js   # pruebas de física (ver §8)
```
Abrir `dist/index.html` en Chrome con WebGPU (o servir con `python3 -m http.server`). Para el Quest hace falta HTTPS → GitHub Pages:
```bash
git clone https://github.com/minego90/whale-shark-jelly && cp dist/index.html whale-shark-jelly/index.html
cd whale-shark-jelly && git add -A && git commit -m "v37: ..." && git push
```
Pages tarda ~1–2 min. Decirle al usuario el string exacto "Build v37 - …Z".

Pruebas de navegador (necesitan `pip install playwright pillow numpy` y Chrome; en Mac: `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`):
```bash
python3 tests/browser/snap.py out.png 6 "<js previo>" 900 600 6 '#norender'
python3 tests/browser/xrtest.py /tmp/xr.png      # sesión XR falsa (AR place/play/after)
```
`window.__jelly` expone `{ lure, jf(), cam, ST, A, snapshot(), ... }` para scripts. Banderas de URL (`#a,b`): `norender, gpu, nojelly, nojf, nofloor, noshadow, nobead, noblob, noback, clearonly`.

## 5. Arquitectura — tiburón (core.js)

- **Forma**: `gridSdf(a,y,z)` = SDF trilineal del volumen horneado (`GRID_META o[-0.06,-0.02,-0.80], res 0.011, n[314,91,146], sc 0.12`), con `z=abs(z)` para simetría perfecta. Ejes: `a` = largo (cabeza ~0 → cola ~3.4), `y` arriba, `z` lado.
- `YOFF = 0.32` sube el tiburón; el marco "analítico" (perfil, marcas del shader) usa `y - YOFF`.
- `sdfRender` = grid + 0.002 menos el corte de la boca (losa delgada `MOUTH {c:[0.02,0.55,0], r:[0.26,0.03,0.24]}`); `sdfCore` = núcleo lechoso interno.
- **Lattice**: celdas cúbicas (tamaño `ST.cell`, por defecto 0.05–0.06) partidas en 5 tetraedros (TETS_EVEN/ODD), solo celdas dentro del SDF. Solver XPBD por sub-pasos (`ST.nsub`), forma por tetraedro (extractRot = rotación polar), volumen, fricción con piso, `edgeDamp`. Firmeza `ST.firm` y damping `ST.damp` (sliders sFirm/sDamp).
- **Piel de render**: `buildEmbedded` → surfaceNets sobre el SDF → `projectToSdf` → `smoothMesh` → `orientOutward` → `bindMesh` (coordenadas baricéntricas en los tets, pesos ≥ -0.45) → cada frame `skinMesh`/`meshNormals`. Caja fija de la malla (ver comentarios; `ny=ceil(1.1/h)` para no cortar la punta de la aleta dorsal).
- **Ojos**: anclados a vértices de la piel (`world.eyeR`), medio hundidos (`k=-0.026+0.020*ST.eyeExt`), simétricos.
- **Modos**: `ocean` (gravedad baja + arrastre), `swim` (nado: `swimDrive` con objetivo de altura, ondulación de cola, cruising), `gulp`, `swish`, `lure` (Follow my food).
- **Enderezado** (`upright(dt, strength, pitchA)`): usa marcadores dorsales/ventrales del lattice (`dorsIdx`: y > YOFF+0.24, `ventIdx`: y < YOFF+0.06 — ojo: antes de v28 usaba umbrales sin YOFF y ventIdx quedaba vacío → nunca se enderezaba). En piso: si queda volteado >2.2 s da un saltico y rueda. Al nadar, la nariz sigue la velocidad vertical (`SW.pa`).
- **Colisiones**: manos/cabeza XR como esferas (`setColliders(CB, n)`, 8 floats: pos, r, prevpos), puntero de mouse = agarre (`pickVertex/beginGrab/moveGrab/endGrab`), varios agarres con id.

## 6. Otros sistemas

- **Krill** (core.js `createKrill`): KPI=11 partes por krill (KPARTS), cuerpo translúcido + órganos + patas/antenas (bead kinds 4/5/6); nadan, cazan, reaccionan a manos; el tiburón se los come.
- **Follow my food** (app.js `lure*`): un krill grande (LURE_K=7). Desde v27 solo aparece de vez en cuando: 1.2 s al activar, y tras ser comido espera 7–16 s (`lure.act / lure.wait`).
- **Kelp** (core.js `createKelp`): 7 matas × 5 hojas × 9 segmentos, hojas cónicas con gradiente y nervio central (bead kind 3), colisión con cuerpo y manos, se reubican con pinch en XR.
- **Medusas** (parts/jf.js `createJellies(world)`), 3 unidades:
  - Malla de campana de 2 capas (exterior/interior) cerrada, `JF_NS=24` sectores × `JF_NR=6` anillos; forma relajada/contraída `jfShape(c)` (8 lóbulos suaves); restricciones: bordes (rest length interpolada con el pulso), volumen global, forma objetivo suave alrededor del centroide, colisión con esferas del tiburón (vértices de superficie submuestreados) y manos, piso.
  - En el piso flácidas hasta activar **Swim**; nadando: pulso (contracción 28% / relajación), waypoints aleatorios repartidos por el plato lejos de las otras, inclinación hacia la dirección, flotación casi neutra (`grav = 9*(1-0.985*act)`), empuje vertical según altura objetivo, separación dura entre medusas (D0=0.5) + evasión.
  - 16 tentáculos finos (cadenas verlet, 12 seg.) + 4 brazos orales con volantes (cadenas de 11 seg., discos girados) + manubrio; todos colisionan con manos. Render como instancias kind 7.
  - Se agarran como el tiburón (mouse y XR pinch/rayo: `J.pick/near/grab/move/release`) y usan los mismos sliders de firmeza y damping (`J.setParams`).
  - Colores: degradado azul (corona) → violeta (borde) en `fsJfish`; tentáculos lila.
  - Botón "Jellyfish" las muestra/oculta (`ST.jf`). Costo ≈ 2.5 ms/frame en PC.
- **Sonido** (audio.js): ambiente de océano sintetizado, slider `sSnd` y stepper "Ocean sound" en XR. El usuario puede dar un audio real si quiere reemplazarlo.
- **Underwater blue** (`ST.uw`, uniforme `g.tint.w`): tiñe solo el fondo/piso de azul (más profundo arriba y lejos). En AR pone un velo azul leve sobre el passthrough (desde v32).
- **Light rays / cáusticas** (`ST.cau`, uniforme `g.pale.w`): patrón calculado UNA vez por frame en una textura 256² tileable (`CAU_WGSL` en app.js, periodo 2π, canales r/g = dos capas con tiempos distintos), muestreada en `caus(P)` (shaders.js) proyectando a lo largo de la luz. Se aplica a piso, tiburón, beads (kelp/krill) y medusas; en AR sobre el piso real (aditivo vía alpha). v30 las calculaba por píxel y era lento en Quest → v31 textura.

## 6b. Añadido en v32
- **Scatter krill** es un interruptor (`ST.krillOn`): al activarlo suelta 60 krill; la siguiente tanda (35–49) cae solo cuando el tiburón se comió casi todo (≤2 vivos) y pasaron 5–9 s, o si quedan ≤8 sin comer por más de 40 s (`ST.kWait`, `ST.kStall`, `krillDrop`). (v35)
- **Paredes y techo** (`ROOM` + `roomPush(P, i, r, V)` en core.js): tiburón (cada vértice por sub-paso), medusas (campana y tentáculos) y krill chocan. En AR se pide `plane-detection` (opcional) y `roomFromXR` convierte los planos reales a unidades de escena cada 20 frames (normal orientada hacia la cabeza, se ignora el plano donde está el plato, extents del polígono + 5 cm). Si hay menos de 2 planos o no es AR → cuarto virtual: cilindro R y techo H (PC: R 7.5, H 5.5 unidades; XR: 2.2 m y 2.5 m convertidos con la escala). El panel XR muestra "walls N".
- **Underwater blue en AR**: velo azul leve (alpha ≈0.3) sobre el passthrough en `fsFloor`; los objetos virtuales no se tiñen.
- **Onda de color al tocar medusas**: cada toque (mano XR o agarre) registra un evento por medusa (máx. 4, cada ≥0.28 s); `ripple()` calcula por vértice un anillo que se expande (0.28 u/s, ~1.6 s) + destello local, y lo escribe en `rest4.w`, que se sube cada frame (`buf.jrest`). `fsJfish` lo pinta aqua↔rosado y vuelve al color normal.

## 6c. Añadido en v33
- **Medusas en modo "hold"**: al apagar Swim (después de haber nadado) ya no caen; cada una se queda anclada donde estaba (`b.anc`, resorte + amortiguación, flotación neutra). Si **Swish tail** está activo pulsan en su sitio; si no, quedan quietas y relajadas. Si la mano la mueve/lanza, se re-ancla donde termina (1.5 s). Reset → vuelven al piso; Swim otra vez → vuelven a pasear. `J.setSwim(swim, swish)`.

## 6d. Añadido en v34
- **Manos**: no hay malla de la mano; son ~45 esferas por mano (cada articulación del hand-tracking con su radio, puntos medios de huesos, relleno de palma y nudillos, muñeca), con posición previa para barridos.
- **Colisión mano↔medusa barrida**: la esfera se interpola por sub-paso (4 cuando hay manos) y, si el dedo se mueve rápido, todo lo que está en su trayectoria se empuja por delante (antes un toque rápido atravesaba la campana delgada: test `tpoke.js`, antes 0.005 → ahora 0.83 de arrastre).
- **Onda de color más fuerte**: anillo más ancho, destello, tinte de toda la campana (2.2 s), más opaco mientras brilla; los tentáculos también se iluminan (`kind = 7 + 0.45*glow`).

## 6e. Añadido en v36 (panel XR)
- **Tocar con el dedo**: `fingerPanel()` cada frame lleva la punta del índice (`index-finger-tip`) a coordenadas del panel (`panelLocal`): hover a < 5 cm, presiona al llegar a < 1.2 cm del vidrio (una vez por toque, re-arma al alejarse > 2.5 cm, 350 ms entre toques). `pressItem()` es la lógica común de botones/steppers (también la usa el rayo).
- **Barra para mover**: barra bajo los botones (`BAR_Y`, PNH 1400). Pinch con la mano cerca de la barra o del título → el panel sigue el punto del pinch (`s.pgrab.direct`); con el rayo + pinch sobre la barra o el título también se arrastra.

## 7. Render (app.js + shaders.js)

- Pases por vista: sombras (shF/shB depth) → escena a `vr.scene` (rgba16float) + profundidad trasera `vr.back` (r32float, para grosor del gel) → pase final al canvas/ojo: piso, beads, tiburón con refracción (sceneTex) + absorción + marcas procedurales (`markings()`), medusas (`fsJfish`), panel, láser, retícula.
- Bind group 0 (`bgl`): 0 uniforms G, 1 sceneTex, 2 backTex, 3 sampler, 4/5 sombras, 6 cauTex, 7 cauSamp (repeat).
- Uniform G: ver `writeG` — slots V(i): 0 cam+time, 1 camFwd + lu, 2 luz + flare, 3 viewport, 4 absorb, 5 tint (+w = underwater), 6 pig, 7 pale (+w = caustics), 8 milk (+w = AR), 9 bgLow, 10 bgTop, 11 glow, 12 mesh/mouth, 13 ojo, 14 espiráculo, luego perfil.
- Instancias (12 floats): pos3, kind, quat4, scale3, shade. Kinds: 0 krill viejo/lure, 1 ojo, 2 punto de mano, 3 kelp, 4/5/6 krill (cuerpo/órganos/patas), 7 medusa (tentáculo shade<0.5, volante ≥0.5, manubrio ≈0.52).
- Paletas `WAYS` (Ocean, Lagoon, Dusk, Coral): absorb/tint/pig/pale/milk/glow/bg.
- **XR en Quest**: Quest Browser no tiene XRGPUBinding → se renderiza con WebGPU a un canvas offscreen por ojo y se copia a una capa WebGL XR ("puente", `makeBridge/bridgeBegin/bridgeEnd`). `#gpu` fuerza binding nativo donde exista. Panel XR dibujado en canvas 2D (PNW 640 × PNH 1400, barra para mover en BAR_Y) como textura; items en `VR_ITEMS` (`add('btn'|'stepper'|..., label, x, w, h, {y, on, fn})`).
- Colisionadores XR: articulaciones/huesos/palma de ambas manos + esferas de cabeza (getViewerPose).

## 8. Pruebas existentes (tests/sim, Node)

- `tjf.js` malla de medusa cerrada, volumen estable, distancia mínima entre medusas, costo.
- `twan.js` recorrido de medusas en 60 s, rango ocupado, separación. `tjy.js` altura/fracción cerca del piso.
- `tjg.js` agarre de medusa + firmeza. `tor.js` brazos orales cuelgan debajo.
- `tflip.js` tiburón volteado se endereza en piso/océano/nado. `tsw.js` nado: altura y cabeceo.
- `troom.js`/`troom2.js` paredes y techo (virtual y planos). `trip.js` onda de color. `thold.js` medusas quietas al apagar Swim. `tpoke.js` dedo rápido no atraviesa.
- `t9–t17` regresiones del tiburón (lattice, boca, ojos…). Ejecutar desde cualquier lado: leen `src/core_node.js` (generado por build.sh).

## 9. Modelo de referencia y horneado (tools/bake)

Modelo: "Model 99A - Whale Shark" de DigitalLife3D (Sketchfab), **CC BY-NC 4.0** — https://sketchfab.com/3d-models/model-99a-whale-shark-8893d07e44964a8a934521e06cf51854 (el usuario tiene el zip `model_99a_-_whale_shark.zip`, 128 MB, no incluido aquí).
Pipeline: `extract_mesh.py` (glTF → P.npy/T.npy, verificado idéntico) → `voxelize_sdf.py` (escala 0.68, eje a = (2.3613 - z)*s, rasteriza triángulos, rellena, distancia con signo, res 0.011) → `encode_grid.py` (cuantiza a uint8, zlib, base64). Nota: el `grid.js` publicado es la fuente de verdad; el encode reproduce ~76–80% de bytes idénticos (hubo un ajuste/suavizado intermedio no guardado). Si se re-hornea, revisar visualmente boca/ojos/aletas.

## 10. Pendientes / ideas

- Verificar en Quest (nada de v27–v36 se ha confirmado en el visor por Claude): rendimiento con medusas + cáusticas, paredes reales (plane-detection), toque con el dedo en el panel y su distancia, colisión barrida de dedos, sonido, picos dentro de la boca al jalar la mandíbula (render-cavity = lattice-cavity desde v20, sin confirmar).
- `GL error 1281` en el puente XR: causa raíz desconocida (no rompe).
- Cáusticas "paso 2" (idea acordada): en AR proyectarlas sobre paredes/muebles usando **WebXR depth-sensing** (Quest 3/3S, solo GPU, 30 fps) o **mesh-detection** (malla del cuarto). Requiere hacerlo del lado WebGL del puente.
- Audio real de océano si el usuario lo provee.
- Licencia NC: si se usa en clases pagas, cambiar a un modelo propio/licenciado.
