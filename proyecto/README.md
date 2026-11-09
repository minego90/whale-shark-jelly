# Whale Shark Jelly — carpeta completa del proyecto

Tiburón ballena de gelatina (soft-body) con medusas, krill, kelp, sonido de océano y cáusticas, para PC (WebGPU) y Meta Quest 3/3S (WebXR AR/VR).

- **Ver en vivo:** https://minego90.github.io/whale-shark-jelly/ (última versión: v31)
- **Abrir local:** `dist/index.html` en Chrome (WebGPU).
- **Para Claude (en cualquier computador):** abre esta carpeta y lee primero **CLAUDE.md** — tiene la arquitectura completa, cómo compilar/probar/publicar, decisiones y pendientes.

## Contenido
| Carpeta | Qué hay |
|---|---|
| `src/` | Código fuente por partes + `build.sh` + `VERSION` |
| `dist/index.html` | La página compilada (un solo archivo) |
| `tests/sim/` | Pruebas de física en Node |
| `tests/browser/` | Capturas headless y simulación XR (Playwright + Chrome) |
| `tools/bake/` | Scripts para hornear el volumen del tiburón desde el modelo 3D |
| `reference/` | Imágenes de referencia, licencia del modelo |
| `docs/` | Historial de versiones y capturas |

## Compilar
```bash
cd src && ./build.sh      # requiere Node; genera ../dist/index.html con la versión visible
```

Crédito: forma del cuerpo basada en "Model 99A - Whale Shark" de DigitalLife3D (CC BY-NC 4.0, uso no comercial).
