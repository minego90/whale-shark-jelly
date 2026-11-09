# Novedades desde la carpeta anterior (v31 → v36)

Todo esto ya está en `src/` y publicado (Build v36 - 11-09_18:09Z). Detalles técnicos en CLAUDE.md §6b–6e; uso en GUIA_DE_USO.md.

| Versión | Qué se mejoró |
|---|---|
| **v32** | **Scatter krill** pasa a ser interruptor con tandas periódicas · **Paredes y techo**: en AR usa los planos reales del cuarto (WebXR `plane-detection`), si no hay, un cuarto invisible; tiburón, medusas (campana y tentáculos) y krill chocan y no se van al infinito · **Underwater blue en AR**: velo azul leve sobre el passthrough · **Onda de color** al tocar medusas (anillo aqua/rosado que recorre la campana y vuelve a su color) |
| **v33** | Al apagar **Swim** las medusas **se quedan quietas donde están** (ya no caen); con **Swish tail** activo pulsan en su sitio; si las mueves/lanzas se quedan donde terminan |
| **v34** | **Onda de color mucho más visible** (más opaca, toda la campana, también los tentáculos, ~2 s) · **Colisión de dedos barrida**: un toque rápido con un dedo ya no atraviesa las medusas (antes la colisión era solo en el punto actual; ahora la esfera de cada parte de la mano se barre desde su posición anterior y empuja lo que encuentra) |
| **v35** | Scatter krill: suelta **menos** (60, luego 35–49) y la siguiente tanda **solo cuando el tiburón se comió la anterior** (o si quedan pocos sin comer por 40 s) → más fluido |
| **v36** | **Panel XR táctil**: se presiona tocando el vidrio con la punta del índice (además del rayo + pinch) · **Barra para mover el panel** abajo: pinch y arrastrar (también desde el título) |

Pendiente de confirmar en el Quest: rendimiento, paredes reales ("walls N" en el panel), distancia de toque del panel, colisión de dedos.
