const layers = [
  ['Cejas', 'Cejas'], ['Barba', 'Barbas'], ['Marcas', 'Marcas'], ['Nariz', 'Nariz'],
  ['Ojos', 'Ojos'], ['Orejas', 'Orejas'], ['Pelo', 'Pelo'], ['Sombras', 'Sombras'],
  ['Dientes', 'Dientes'], ['Boca', 'Boca'], ['Base', 'Base'],
];
const fixedLayers = new Set(['Sombras', 'Base']);
const palettes = {
  Labios: ['#d8867d', '#d87c7d', '#c87653', '#c88887'],
  Piel: ['#ffcc99', '#ecc7ad', '#e8b4a3', '#d68657', '#261917'],
  Ojos: ['#eba4a3', '#383d42', '#4c734c', '#4c73a3', '#541b11', '#3c292b'],
  Pelo: ['#060507', '#46261e', '#f8d487', '#cccccc', '#87423c', '#87603c', '#c2983f'],
  'Sombra pelo': ['#4c271d', '#bebebe', '#0b0c10', '#d3b25d'],
  Dientes: ['#fff3dd', '#fff3c8', '#fff3f4', '#ffffff'],
  Marcas: ['#ba9088', '#9f8262', '#bb7887', '#a59596'], Cavidad: ['#2c1b0e'],
  Blanco: ['#fdfbfb'], Negro: ['#060507'],
};
// `source` is the colour actually stored in the supplied SVG files. Dientes uses
// the equivalent shorthand #f0f rather than the long #ff00ff form.
const sourceColors = {
  Labios: ['#ff931e'], Piel: ['#ff7bac'], Ojos: ['#39b54a'], Pelo: ['#ff1d25'],
  'Sombra pelo': ['#662d91'], Dientes: ['#f0f', '#ff00ff'], Marcas: ['#3fa9f5'],
  Cavidad: ['#9e005d'], Blanco: ['#fdfbfb'], Negro: ['#060507'],
};
const state = { choices: {}, colors: Object.fromEntries(Object.entries(palettes).map(([key, values]) => [key, values[0]])), files: {} };
const svg = document.querySelector('#portrait');
const layerControls = document.querySelector('#layer-controls');

async function getFiles(folder) {
  // File names are intentionally listed from the repository so this also works on static hosts.
  const known = { Cejas: ['CA','CB','CC','CD','CE','CF','CH'], Barbas: ['BA','BB','BC','BD','BF','BG','BH','BI'], Marcas: ['MA','MB','MC','MD','ME','MF','MG','MH','MI','MJ','MK'], Nariz: ['NA','NB','NC','ND','NE','NF','NG','NH','NI','NJ','NK','NL'], Ojos: ['OA','OB','OC','OD','OF','OH','OI','OJ','OK'], Orejas: ['ORA','ORB','ORC','ORD','ORE','ORF','ORG'], Pelo: ['PA','PB','PC','PD','PE','PF','PG','PH','PI','PJ','PK','PL','PM','PN','PO'], Dientes: ['DA','DB','DC','DE'], Boca: ['BOA','BOB','BOC','BOD','BOE'] };
  const stems = fixedLayers.has(folder) ? [folder === 'Sombras' ? 'Sombras' : 'Base'] : known[folder];
  return Promise.all(stems.map(async stem => ({ name: stem, markup: await fetch(`Export/${folder}/${stem}.svg`).then(response => response.text()) })));
}
function bodyOf(markup) { return markup.replace(/<\?xml[^>]*>/i, '').replace(/^\s*<svg[^>]*>|<\/svg>\s*$/gi, ''); }
function paint(markup) {
  // Replace each original SVG colour in a single pass so selecting a palette
  // colour that matches another source colour can never trigger a second swap.
  const replacements = Object.entries(sourceColors).flatMap(([name, sources]) => sources.map(source => [source.slice(1).toLowerCase(), state.colors[name]]));
  const lookup = new Map(replacements);
  return markup.replace(/#[0-9a-f]{3,6}\b/gi, colour => lookup.get(colour.slice(1).toLowerCase()) || colour);
}
function render() {
  // The supplied order is foreground-to-background, so reverse it for SVG painter's order.
  const content = [...layers].reverse().map(([label, folder]) => {
    const file = state.files[folder]?.[state.choices[folder] ?? 0];
    return file ? `<g id="layer-${folder}">${bodyOf(paint(file.markup))}</g>` : '';
  }).join('');
  svg.innerHTML = content;
}
function setProgress(input) { input.style.setProperty('--progress', `${(input.value / Math.max(1, input.max)) * 100}%`); }
function buildLayerControls() {
  const template = document.querySelector('#layer-template');
  layers.filter(([label]) => !fixedLayers.has(label)).forEach(([label, folder]) => {
    const node = template.content.cloneNode(true); const input = node.querySelector('input'); const output = node.querySelector('output');
    node.querySelector('label').textContent = label; input.max = state.files[folder].length - 1; input.value = state.choices[folder]; output.textContent = `${Number(input.value) + 1}/${state.files[folder].length}`; setProgress(input);
    input.addEventListener('input', () => { state.choices[folder] = Number(input.value); output.textContent = `${Number(input.value) + 1}/${state.files[folder].length}`; setProgress(input); render(); });
    layerControls.append(node);
  });
}
function buildColorControls() {
  const container = document.querySelector('#color-controls');
  Object.entries(palettes).forEach(([name, values]) => {
    const label = document.createElement('label'); label.className = 'color-picker';
    const swatches = values.map(color => `<i style="background:${color}" aria-hidden="true"></i>`).join('');
    label.innerHTML = `<span>${name}</span><div class="color-input"><i class="selected-swatch" aria-hidden="true"></i><select aria-label="Color de ${name}">${values.map(color => `<option value="${color}">${color.toUpperCase()}</option>`).join('')}</select></div><div class="swatches">${swatches}</div>`;
    const select = label.querySelector('select'); const selectedSwatch = label.querySelector('.selected-swatch');
    const applyColor = () => { state.colors[name] = select.value; selectedSwatch.style.background = select.value; render(); };
    select.value = state.colors[name]; selectedSwatch.style.background = select.value; select.addEventListener('change', applyColor); container.append(label);
  });
}
function syncControls() { document.querySelectorAll('.control-row input').forEach(input => input.dispatchEvent(new Event('input'))); document.querySelectorAll('.color-picker select').forEach(select => select.value = state.colors[select.closest('.color-picker').querySelector('span').textContent]); }
function randomize() { Object.keys(state.files).forEach(folder => { if (!fixedLayers.has(folder)) state.choices[folder] = Math.floor(Math.random() * state.files[folder].length); }); Object.entries(palettes).forEach(([name, values]) => { state.colors[name] = values[Math.floor(Math.random() * values.length)]; }); syncControls(); render(); }
function download() { const output = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048">${svg.innerHTML}</svg>`; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([output], { type: 'image/svg+xml' })); link.download = 'mi-caragen.svg'; link.click(); URL.revokeObjectURL(link.href); }
async function init() { await Promise.all(layers.map(async ([label, folder]) => { state.files[folder] = await getFiles(folder); state.choices[folder] = 0; })); buildLayerControls(); buildColorControls(); render(); document.querySelector('#loading').classList.add('hidden'); document.querySelector('#selection-count').textContent = layers.length - fixedLayers.size; document.querySelector('#randomize').addEventListener('click', randomize); document.querySelector('#download').addEventListener('click', download); }
init().catch(error => { document.querySelector('#loading').textContent = `No se pudo cargar el retrato: ${error.message}`; });
