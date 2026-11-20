# 🏋️ Gym Tracker (Google Apps Script)

App personal y gratuita para registrar tu rutina y tu progreso en el gym, al estilo de Strong o Hevy.
Corre como web app de Google Apps Script y guarda todo en un Google Sheets tuyo.

## Qué hace

- **Rutina**: armás tus días (Push, Pull, Pierna…) con ejercicios, series y reps objetivo (ej. `8-12`). Trae una rutina de ejemplo.
- **Entrenar**: elegís el día (te sugiere el siguiente de tu rotación). Cada ejercicio aparece con lo que hiciste **la última vez** y el peso ya cargado. Tocás ✓ en cada serie y arranca el **timer de descanso**, que vibra y suena al terminar.
- **Sobrecarga progresiva automática**: si la última vez completaste todas las series en el tope del rango, te dice "⬆ Subí a X kg" y te carga ese peso. El incremento se configura por ejercicio (columna **+kg**).
- **Récords**: al guardar te avisa si superaste tu peso máximo o tu 1RM estimado.
- **Progreso**: gráfico por ejercicio (peso máx, 1RM estimado, volumen o reps), **día a día** o **semana a semana**, con cuánto subiste desde el inicio y en las últimas 4 semanas. También muestra el volumen semanal total y la tabla de récords personales.
- **Historial**: entrenamientos agrupados por semana; podés editarlos o eliminarlos.
- Si se te cierra el navegador a mitad del entrenamiento, **no perdés nada** porque el borrador queda guardado en el teléfono.

## Instalación (unos 5 minutos)

1. Creá un Google Sheets nuevo (por ejemplo "Gym Tracker").
2. En el menú, abrí **Extensiones → Apps Script**.
3. Pegá el contenido de los archivos:
   - Reemplazá el contenido de `Código.gs` con el de [`Code.gs`](Code.gs).
   - Hacé clic en **+ → HTML**, nombralo exactamente `Index` y pegá el contenido de [`Index.html`](Index.html).
   - (Opcional) En ⚙️ Configuración del proyecto, activá "Mostrar el archivo de manifiesto appsscript.json" y pegá [`appsscript.json`](appsscript.json). Cambiá la `timeZone` a la tuya.
4. Hacé clic en **Implementar → Nueva implementación → tipo: Aplicación web**.
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Solo yo**
5. Autorizá los permisos. Google va a decir "app no verificada": entrá en *Configuración avanzada → Ir a (tu proyecto)*. Es normal porque la app la escribiste vos.
6. Abrí la URL que termina en `/exec` desde el celular y elegí **Agregar a pantalla de inicio**. Así queda como una app más.

> Cuando cambies el código, andá a **Implementar → Administrar implementaciones → ✏️ → Versión: nueva** para que la URL `/exec` tome los cambios.

### Alternativa con clasp (desde la terminal)

```bash
npm i -g @google/clasp
clasp login
clasp create --type sheets --title "Gym Tracker"
clasp push
clasp deploy
```

## Dónde están tus datos

En el mismo Google Sheets, en dos hojas:

| Hoja | Columnas |
|---|---|
| `Rutina` | dia, ejercicio, series, reps, incremento, notas |
| `Registros` | sesionId, fecha, dia, ejercicio, serie, peso, reps, rpe, notas, creado |

Cada fila de `Registros` es una serie. Podés hacer tus propios gráficos o tablas dinámicas sobre esa hoja.

## Detalles técnicos

- 1RM estimado con la fórmula de Epley: `peso × (1 + reps/30)`.
- Las semanas empiezan el lunes.
- Gráficos con Chart.js. La app carga primero los datos guardados en el teléfono y después los actualiza desde la planilla, así abre más rápido.
