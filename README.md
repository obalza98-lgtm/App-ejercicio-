# 🔥 HIERRO — tu app de gym + comida (Google Apps Script)

*El hierro no miente.*

App personal y gratuita para entrenar, comer y medir tu progreso, al estilo de Hevy + MyFitnessPal, pero tuya.
Corre como web app de Google Apps Script y guarda todo en un Google Sheets tuyo. No hay suscripción ni servidores.

## Qué tiene

### 🏋️ Entrenamiento
- **Rutina por días** (Push / Pull / Pierna o la tuya), con series × reps objetivo. Trae una de ejemplo.
- **Modo entrenamiento al estilo Hevy**: cronómetro, volumen y series en vivo; muestra lo que hiciste la vez anterior, con el peso ya cargado.
- **Sobrecarga progresiva automática**: si completaste todas las series en el tope del rango, te dice `⬆ SUBÍ A 70 KG` y te carga ese peso.
- **Timer de descanso** que arranca solo al marcar una serie, y vibra y suena al terminar.
- **Detección de récords** al guardar, y un historial que podés editar.

### 🍗 Comida y calorías
- **Objetivo automático** de calorías y macros según sexo, edad, altura, peso, actividad y objetivo (definir, mantener o volumen). Usa la fórmula de Mifflin-St Jeor.
- **Base de más de 90 alimentos comunes** que funciona sin internet, más **búsqueda online** en Open Food Facts (millones de productos con marca, también por **código de barras**).
- Alimentos recientes, alimentos propios (copiando la etiqueta), **calorías rápidas** y **copiar las comidas de ayer**.
- Anillo de calorías restantes y barras de proteína, carbohidratos y grasas por día.

### ⚖️ Peso corporal
- Registro diario con promedio móvil de 7 días.
- **Ajuste automático de calorías**: compara cuánto cambia tu peso real con lo que buscás y te sugiere subir o bajar calorías.

### 📈 Progreso
- Por ejercicio: peso máximo, 1RM estimado, volumen y reps, **día a día o semana a semana**.
- **Series por grupo muscular** en la semana, con la zona recomendada de 10–20 series. El grupo se detecta solo por el nombre del ejercicio.
- Volumen semanal, peso corporal, calorías de los últimos 14 días contra tu objetivo, y récords personales.

### 🤖 Automatizaciones (se activan desde **Perfil**)
- **Reporte semanal por mail** (lunes 8 am): entrenamientos contra tu meta, volumen, récords, calorías y proteína promedio, y cambio de peso.
- **Recordatorio diario** a la hora que elijas. Solo te escribe si no registraste comida, si hace 3 días o más que no entrenás, o si hace una semana que no te pesás.
- **Deploy automático desde GitHub** (opcional, ver más abajo).

### 😤 Personalidad
Racha 🔥 de semanas cumpliendo tu meta, frases del día, mensajes al terminar ("BESTIA. Sesión guardada.") y tu tonelaje total comparado con elefantes 🐘.

## Dos formas de usarla

- **Versión en Claude, sin instalar nada:** ya publicada como página privada tuya en claude.ai. Guarda tus datos en tu cuenta de Claude y suma **IA**: calorías a partir de una descripción o una foto, y un coach que analiza tus últimas 4 semanas. No trae el buscador online ni los mails automáticos. Se genera con `python3 web/build_claude.py`, que crea `web/hierro-claude.html` a partir de `Index.html`.
- **Versión Google Sheets (Apps Script):** tus datos en tu planilla, buscador online de alimentos y mails automáticos. Instalación abajo.

El mismo `Index.html` sirve para las dos: detecta solo dónde está corriendo.

## Instalación en Google Sheets (unos 5 minutos)

1. Creá un Google Sheets nuevo (por ejemplo "HIERRO").
2. En el menú, abrí **Extensiones → Apps Script**.
3. Pegá los archivos:
   - Reemplazá el contenido de `Código.gs` con el de [`Code.gs`](Code.gs).
   - Hacé clic en **+ → HTML**, nombralo exactamente `Index` y pegá [`Index.html`](Index.html).
   - (Opcional) En ⚙️ Configuración del proyecto, activá "Mostrar el archivo de manifiesto appsscript.json", pegá [`appsscript.json`](appsscript.json) y poné tu `timeZone`.
4. Andá a **Implementar → Nueva implementación → Aplicación web**, con *Ejecutar como: Yo* y *Quién tiene acceso: Solo yo*.
5. Autorizá los permisos. Google va a decir "app no verificada": entrá en *Configuración avanzada → Ir a (tu proyecto)*. Es normal porque la app la escribiste vos. Pide acceso a tu planilla, a enviar mails (para los reportes), a internet (para buscar alimentos) y a crear tareas programadas (para las automatizaciones).
6. Abrí la URL `/exec` desde el celular y elegí **Agregar a pantalla de inicio**.
7. En **Perfil**, completá tus datos y activá las automatizaciones.

> Si actualizás el código a mano: **Implementar → Administrar implementaciones → ✏️ → Versión: nueva**. Así la URL no cambia.

### Si ya tenías la versión anterior
Pegá los dos archivos nuevos encima de los viejos y publicá una versión nueva. Tus hojas `Rutina` y `Registros` se mantienen, y las hojas nuevas se crean solas.

## Deploy automático desde GitHub (opcional)

Con esto, cada cambio que entra en `main` se sube solo a Apps Script, sin copiar y pegar.

1. En tu compu: `npm i -g @google/clasp@2.4.2 && clasp login`. Antes, activá la API en https://script.google.com/home/usersettings.
2. En GitHub, en **Settings → Secrets and variables → Actions**, creá:
   - `CLASPRC_JSON`: el contenido de `~/.clasprc.json`.
   - `SCRIPT_ID`: en Apps Script, ⚙️ Configuración del proyecto → ID de la secuencia de comandos.
   - `DEPLOYMENT_ID`: en Implementar → Administrar implementaciones, el ID de tu aplicación web.
3. Listo: el workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) hace `clasp push` y actualiza la implementación.

## Tus datos

Todo queda en el Google Sheets, en hojas que podés ver y exportar:

| Hoja | Qué guarda |
|---|---|
| `Rutina` | día, ejercicio, series, reps, incremento, notas |
| `Registros` | una fila por serie: fecha, ejercicio, peso, reps, RPE… |
| `Comidas` | una fila por alimento: fecha, comida, gramos, kcal y macros |
| `Alimentos` | tus alimentos propios y los que agregaste desde la búsqueda online (por 100 g) |
| `PesoCorporal` | fecha, peso |
| `Config` | tu perfil, objetivos y automatizaciones |

## Detalles técnicos
- 1RM estimado con la fórmula de Epley. Las semanas empiezan el lunes.
- Proteína: 2 g/kg (2,2 g/kg si estás definiendo). Grasas: 0,8 g/kg. Carbohidratos: el resto de las calorías.
- El ajuste automático usa una regresión sobre los últimos 21 días de peso (mínimo 6 registros) y se mueve en saltos de 50 kcal, como mucho ±300.
- La app guarda una copia de los datos en el teléfono: abre al instante y, si se corta el internet a mitad de un entrenamiento, no perdés nada.
