'use strict';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const text = value => escapeHTML(value);
const capitalize = value => value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const labels = {mean:'Mean',ctx:'Ctx',acc:'Acc',title:'Title',culture:'Culture',period:'Period',origin:'Origin',creator:'Creator',valid:'Valid',invalid:'Invalid'};
const shortMuseum = value => /Metropolitan/.test(value) ? 'The Met' : 'Getty';
const ref = (object, key) => (object.reference?.[key] || []).join(' / ') || 'Not recorded';
const firstRef = (object, key) => object.reference?.[key]?.[0] || 'Not recorded';
const imageURL = object => object.localImage || object.image;
const format = value => Number(value).toFixed(2);
let collection = [], filteredObjects = [], visibleLimit = 12, currentObject = null;
let tableData = null, sortMetric = 'acc', sortDirection = -1;
let tourTimer = null;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

function imageMarkup(object, eager = false) {
  return `<img src="${text(imageURL(object))}" alt="${text(object.title)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
}

function selectHeroObjects() {
  // Spread the opening display across regions and object types.
  const chosen = [];
  const preferences = [
    {region:'East_Asia',type:'ceramics'},
    {region:'Ancient_Mediterranean',type:'sculpture'},
    {region:'Americas',type:'ceramics'},
    {region:'Europe',type:'sculpture'},
    {region:'Ancient_Mediterranean',type:'ceramics'}
  ];
  for (const preference of preferences) {
    const object = collection.find(o => o.region.replace(/ /g,'_') === preference.region && o.type === preference.type && !chosen.includes(o))
      || collection.find(o => !chosen.includes(o));
    if (object) chosen.push(object);
  }
  $('#hero-gallery').innerHTML = chosen.map(o => `<button class="hero-object" data-object="${text(o.id)}" aria-label="Explore ${text(o.title)}">${imageMarkup(o,true)}</button>`).join('');
}

function initializeFilters() {
  for (const [key,selector] of [['region','#region-filter'],['type','#type-filter'],['museum','#museum-filter']]) {
    const values = [...new Set(collection.map(o => o[key]))].sort();
    for (const value of values) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = key === 'museum' ? shortMuseum(value) : capitalize(value);
      $(selector).append(option);
    }
  }
}

function filterCollection() {
  const query = $('#gallery-search').value.toLocaleLowerCase().trim();
  const region = $('#region-filter').value;
  const type = $('#type-filter').value;
  const museum = $('#museum-filter').value;
  filteredObjects = collection.filter(o => (!region || o.region === region) && (!type || o.type === type) && (!museum || o.museum === museum) && (!query || [o.title,o.region,o.type,o.museum,...Object.values(o.reference || {}).flat()].join(' ').toLocaleLowerCase().includes(query)));
  visibleLimit = 12;
  stopTour();
  renderGallery();
}

function renderGallery() {
  const visible = filteredObjects.slice(0,visibleLimit);
  $('#gallery-grid').innerHTML = visible.map((o,i) => `<button class="object-card" data-object="${text(o.id)}" aria-label="Explore ${text(o.title)}, ${text(firstRef(o,'culture'))}, ${text(firstRef(o,'period'))}"><div class="object-image">${imageMarkup(o)}<span class="card-open" aria-hidden="true">+</span></div><div class="object-meta"><span>${text(capitalize(o.region))}</span><span>${text(shortMuseum(o.museum))}</span></div><h3>${text(o.title)}</h3><p>${text(firstRef(o,'culture'))} · ${text(firstRef(o,'period'))}</p></button>`).join('');
  $('#gallery-count').textContent = `${filteredObjects.length} ${filteredObjects.length === 1 ? 'object' : 'objects'}${filteredObjects.length === collection.length ? ' in this selection' : ' match your filters'} · ${Math.min(visibleLimit,filteredObjects.length)} shown`;
  $('#gallery-scope').textContent = `${collection.length} selected objects from the 750-object benchmark · all 15 region–type cells`;
  $('#gallery-empty').hidden = filteredObjects.length > 0;
  $('#load-more').hidden = visibleLimit >= filteredObjects.length;
  $('#discover-button').disabled = filteredObjects.length === 0;
  $('#motion-toggle').disabled = filteredObjects.length < 2;
}

function openObject(id) {
  const object = collection.find(o => o.id === id);
  if (!object) return;
  stopTour();
  currentObject = object;
  const rightsURL = object.rightsURL || 'https://creativecommons.org/publicdomain/zero/1.0/';
  const record = `<div class="dialog-image">${imageMarkup(object,true)}</div><div class="dialog-record"><span class="dialog-kicker">${text(capitalize(object.region))} / ${text(capitalize(object.type))}</span><h2 id="object-dialog-title">${text(object.title)}</h2><dl class="dialog-fields"><div><dt>Collection</dt><dd>${text(object.museum)}</dd></div>${['culture','period','origin','creator'].map(key => `<div><dt>${text(capitalize(key))}</dt><dd>${text(ref(object,key))}</dd></div>`).join('')}<div><dt>Object ID</dt><dd>${text(object.id.split('_')[0])}</dd></div></dl><div class="dialog-links"><a class="text-link" href="${text(object.source)}" target="_blank" rel="noopener">Museum record ↗</a><a class="text-link" href="${text(object.image)}" target="_blank" rel="noopener">Image source ↗</a></div><p class="rights-note">Image: ${text(object.museum)} · <a href="${text(rightsURL)}" target="_blank" rel="noopener">CC0 1.0</a>.<br>Catalogue fields: released benchmark references. ${shortMuseum(object.museum) === 'Getty' ? 'Getty descriptive metadata: CC BY 4.0.' : 'Met basic collection metadata: CC0 1.0.'}</p></div>`;
  $('.object-dialog-content').innerHTML = record;
  const dialog = $('#object-dialog');
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
  updateObjectNavigation();
}

function updateObjectNavigation() {
  const subset = filteredObjects.length ? filteredObjects : collection;
  $('#previous-object').disabled = subset.length < 2;
  $('#next-object').disabled = subset.length < 2;
}

function navigateObject(direction) {
  const subset = filteredObjects.length ? filteredObjects : collection;
  const index = subset.findIndex(o => o.id === currentObject?.id);
  const next = (index + direction + subset.length) % subset.length;
  if (subset[next]) openObject(subset[next].id);
}

function stopTour() {
  if (tourTimer) clearInterval(tourTimer);
  tourTimer = null;
  $('#motion-toggle').setAttribute('aria-pressed','false');
  $('#motion-toggle').innerHTML = 'Start tour <span aria-hidden="true">▷</span>';
}

function toggleTour() {
  if (tourTimer) { stopTour(); return; }
  setGalleryView('strip');
  visibleLimit = filteredObjects.length;
  renderGallery();
  $('#motion-toggle').setAttribute('aria-pressed','true');
  $('#motion-toggle').innerHTML = 'Pause tour <span aria-hidden="true">Ⅱ</span>';
  const grid = $('#gallery-grid');
  const advance = () => {
    if (document.hidden || $('#object-dialog').open) return;
    const first = grid.querySelector('.object-card');
    if (!first) return;
    const step = first.getBoundingClientRect().width + 25;
    const end = grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 15;
    grid.scrollTo({left:end ? 0 : grid.scrollLeft + step,behavior:reducedMotion.matches ? 'instant' : 'smooth'});
  };
  advance();
  tourTimer = setInterval(advance,3600);
}

function setGalleryView(view) {
  $('#gallery-grid').classList.toggle('strip',view === 'strip');
  for (const [id,active] of [['#gallery-view-grid',view === 'grid'],['#gallery-view-strip',view === 'strip']]) {
    $(id).classList.toggle('active',active);
    $(id).setAttribute('aria-pressed',String(active));
  }
}

const metricInfo = {
  acc:{title:'Complete-record accuracy',description:'All five fields compatible with the museum record.'},
  ctx:{title:'Context accuracy',description:'Culture, period, origin and creator all compatible.'},
  mean:{title:'Mean field compatibility',description:'Average compatibility across the five catalogue fields.'},
  title:{title:'Title compatibility',description:'Recovery of the museum object name or title.'},
  culture:{title:'Culture compatibility',description:'Compatibility with the recorded cultural affiliation.'},
  period:{title:'Period compatibility',description:'Compatibility with the recorded date or historical period.'},
  origin:{title:'Origin compatibility',description:'Compatibility with the recorded place of production or discovery.'},
  creator:{title:'Creator compatibility',description:'Compatibility with the recorded maker, including explicitly unknown creators.'}
};
let selectedModels = ['Qwen3-VL-Flash','GPT-5.4-mini'];
const chartColors = ['#21482D','#BC603D'];
const svgText = (x,y,value,extra='') => `<text x="${x}" y="${y}" ${extra}>${text(value)}</text>`;

function metricScale(metric) {
  const upper = Math.max(...tableData.rows.map(row => row.ci?.[metric]?.[1] ?? row[metric]));
  const step = upper <= 10 ? 2 : upper <= 25 ? 5 : 10;
  return {max:Math.ceil(upper/step)*step,step};
}

function rowDescription(row,metric) {
  const interval = row.ci?.[metric];
  return `${row.model}. ${metricInfo[metric].title}: ${format(row[metric])} percent.${interval ? ` 95 percent object-bootstrap interval: ${format(interval[0])} to ${format(interval[1])} percent.` : ' Confidence interval not reported for this field.'} ${row.valid} valid outputs, ${row.invalid} invalid. ${selectedModels.includes(row.model) ? 'Selected for comparison.' : 'Activate to compare this model.'}`;
}

function renderLeaderboard() {
  if (!tableData) return;
  const container = $('#ranking-chart');
  const focusedModel = document.activeElement?.dataset?.rankModel;
  const width = Math.max(270,Math.floor(container.getBoundingClientRect().width)-26);
  const compact = width < 900;
  const rowHeight = compact ? 110 : 65;
  const left = compact ? 16 : 350;
  const right = compact ? 16 : 132;
  const plotWidth = width-left-right;
  const top = 48;
  const query = $('#model-search').value.toLocaleLowerCase().trim();
  const rows = tableData.rows.filter(row => row.model.toLocaleLowerCase().includes(query)).sort((a,b) => (a[sortMetric]-b[sortMetric])*sortDirection || a.model.localeCompare(b.model));
  const scale = metricScale(sortMetric);
  const sx = value => left+value/scale.max*plotWidth;
  const bottom = top+rows.length*rowHeight;
  const height = Math.max(170,bottom+55);
  const pooled = tableData.pooled[sortMetric];
  const hasCI = ['mean','ctx','acc'].includes(sortMetric);
  $('#active-metric-title').textContent = metricInfo[sortMetric].title;
  $('#active-metric-description').textContent = metricInfo[sortMetric].description;
  $('#interval-key').hidden = !hasCI;
  $('.key-pooled').parentElement.hidden = pooled === undefined;
  $('#chart-uncertainty-note').textContent = hasCI
    ? 'Whiskers: 95% object-bootstrap intervals (10,000 shared resamples). Sorting shows point estimates; overlapping intervals limit fine-grained ranking.'
    : 'Field-specific confidence intervals are not reported in the release. These bars show point estimates. Sorting is exploratory, not a test of significance.';
  for (const button of document.querySelectorAll('[data-metric]')) {
    const active = button.dataset.metric === sortMetric;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  }
  $('#sort-toggle').textContent = sortDirection === -1 ? 'Highest first ↓' : 'Lowest first ↑';
  if (!rows.length) {
    container.innerHTML = '<p class="empty-state">No model matches your search. Clear the search to restore all nine endpoints.</p>';
    $('#leaderboard-status').textContent = 'No matching models.';
    return;
  }
  let markup = `<svg class="ranking-svg" viewBox="0 0 ${width} ${height}" aria-labelledby="ranking-svg-title ranking-svg-description"><title id="ranking-svg-title">${text(metricInfo[sortMetric].title)} across ${rows.length} model endpoints</title><desc id="ranking-svg-description">Bars begin at zero. Select two models to compare their five field scores. Values are percentages of valid outputs.${hasCI ? ' Whiskers show 95 percent object-bootstrap confidence intervals.' : ' Field confidence intervals are not reported.'}</desc>`;
  for (let tick=0;tick<=scale.max;tick+=scale.step) {
    const x=sx(tick);
    markup+=`<line x1="${x}" y1="${top-8}" x2="${x}" y2="${bottom}" stroke="#D4CFC3" stroke-width="1"/>`;
    markup+=svgText(x,25,`${tick}%`,`text-anchor="${tick===0?'start':tick===scale.max?'end':'middle'}" fill="#62685b" font-size="${compact?15:18}"`);
  }
  if (!compact) markup+=svgText(18,25,'MODEL ENDPOINT','fill="#62685b" font-size="15" letter-spacing="1.1"');
  if (pooled !== undefined) markup+=`<line class="pooled-reference" x1="${sx(pooled)}" y1="${top-8}" x2="${sx(pooled)}" y2="${bottom}" stroke="#BC603D" stroke-width="2" stroke-dasharray="6 6" opacity=".8"/>`;
  for (let index=0;index<rows.length;index++) {
    const row=rows[index];
    const y=top+index*rowHeight;
    const center=compact?y+56:y+27;
    const selected=selectedModels.indexOf(row.model);
    const color=selected===1?chartColors[1]:chartColors[0];
    const labelY=compact?y+24:center-3;
    const barEnd=sx(row[sortMetric]);
    const ci=row.ci?.[sortMetric];
    const rank=String(index+1).padStart(2,'0');
    markup+=`<g class="rank-row" role="button" tabindex="0" data-rank-model="${text(row.model)}" aria-label="${text(rowDescription(row,sortMetric))}" aria-pressed="${selected>=0}"><title>${text(rowDescription(row,sortMetric))}</title><rect class="row-highlight" x="2" y="${y-2}" width="${width-4}" height="${rowHeight-3}" rx="6"/>`;
    if (selected>=0) markup+=`<circle cx="${compact?26:24}" cy="${labelY-7}" r="12" fill="${color}"/>`+svgText(compact?26:24,labelY-2,selected===0?'A':'B','fill="white" font-size="14" text-anchor="middle"');
    else markup+=svgText(compact?16:14,labelY,rank,'fill="#62685b" font-size="15"');
    markup+=svgText(compact?49:50,labelY,row.model,`fill="#21482D" font-size="${compact?18:22}" font-weight="${selected>=0?'600':'400'}"`);
    if (!compact) markup+=svgText(50,center+18,`${row.valid} valid · ${row.invalid} invalid`,'fill="#62685b" font-size="16"');
    markup+=`<rect x="${left}" y="${center-11}" width="${Math.max(0,barEnd-left)}" height="22" rx="3" fill="${color}" opacity="${selected>=0?'.82':'.43'}" class="bar-fill"/>`;
    if (ci) {
      const segments=`<line x1="${sx(ci[0])}" y1="${center}" x2="${sx(ci[1])}" y2="${center}"/><line x1="${sx(ci[0])}" y1="${center-8}" x2="${sx(ci[0])}" y2="${center+8}"/><line x1="${sx(ci[1])}" y1="${center-8}" x2="${sx(ci[1])}" y2="${center+8}"/>`;
      markup+=`<g class="ci-halo" stroke="#fcfaf5" stroke-width="5.5">${segments}</g><g class="ci-whisker" stroke="${color}" stroke-width="2.2">${segments}</g>`;
    }
    markup+=`<circle cx="${barEnd}" cy="${center}" r="5" fill="${color}" stroke="#fcfaf5" stroke-width="1.2"/>`;
    markup+=svgText(compact?width-15:width-14,compact?center+34:center+7,`${format(row[sortMetric])}%`,`text-anchor="end" fill="${color}" font-size="${compact?21:25}" font-weight="600"`);
    if (compact) markup+=svgText(left,center+34,`${row.valid} valid · ${row.invalid} invalid`,'fill="#62685b" font-size="14"');
    markup+='</g>';
  }
  if (pooled!==undefined) markup+=svgText(sx(pooled),bottom+32,`Pooled ${format(pooled)}%`,'text-anchor="middle" fill="#BC603D" font-size="16"');
  markup+='</svg>';
  container.innerHTML=markup;
  if(focusedModel){const target=[...container.querySelectorAll('[data-rank-model]')].find(group=>group.dataset.rankModel===focusedModel);target?.focus({preventScroll:true});}
  $('#leaderboard-status').textContent=`${rows.length} models sorted by ${metricInfo[sortMetric].title}, ${sortDirection===-1?'highest':'lowest'} first. Selected: ${selectedModels.join(' and ')}.`;
}

function showChartTooltip(group,event) {
  const row=tableData?.rows.find(row=>row.model===group.dataset.rankModel);
  if (!row) return;
  const ci=row.ci?.[sortMetric];
  const tooltip=$('#chart-tooltip');
  tooltip.innerHTML=`<strong>${text(row.model)}</strong>${text(metricInfo[sortMetric].title)}: <b>${format(row[sortMetric])}%</b><br>${ci?`95% CI: ${format(ci[0])}–${format(ci[1])}%`:'Field CI not reported'}<br><small>${row.valid} valid · ${row.invalid} invalid outputs<br>Click / Enter to compare this model.</small>`;
  tooltip.hidden=false;
  const box=group.getBoundingClientRect();
  const x=event?.clientX??box.left+box.width*.5;
  const y=event?.clientY??box.top+25;
  const rect=tooltip.getBoundingClientRect();
  tooltip.style.left=`${Math.max(12,Math.min(innerWidth-rect.width-12,x+18))}px`;
  tooltip.style.top=`${Math.max(12,Math.min(innerHeight-rect.height-12,y+18))}px`;
}

function selectModel(model) {
  if (selectedModels.includes(model)) return;
  selectedModels=[selectedModels[1],model];
  $('#chart-tooltip').hidden=true;
  renderLeaderboard();
  renderComparison();
}

function renderComparison() {
  if (!tableData) return;
  const [a,b]=selectedModels.map(model=>tableData.rows.find(row=>row.model===model));
  if (!a||!b) return;
  $('#comparison-selectors').innerHTML=[a,b].map((row,index)=>`<div class="compare-model ${index===1?'model-b':''}"><span class="compare-letter">${index===0?'A':'B'}</span><label><span>MODEL ${index===0?'A':'B'}</span><select data-compare-index="${index}" aria-label="Comparison model ${index===0?'A':'B'}">${tableData.rows.map(option=>`<option value="${text(option.model)}"${option.model===row.model?' selected':''}>${text(option.model)}</option>`).join('')}</select></label></div>`).join('');
  $('#comparison-summary').innerHTML=[['mean','Mean field'],['ctx','Context · Ctx'],['acc','Complete record · Acc']].map(([key,label])=>`<div class="compare-stat"><span>${label}</span><div class="compare-stat-values"><b>${format(a[key])}%</b><b class="value-b">${format(b[key])}%</b><small>A − B: ${a[key]-b[key]>=0?'+':''}${format(a[key]-b[key])} pp</small></div></div>`).join('');
  const container=$('#comparison-chart');
  const width=Math.max(250,Math.floor(container.getBoundingClientRect().width));
  const compact=width<700;
  const left=compact?14:150,right=compact?58:90,plotWidth=width-left-right;
  const rowHeight=compact?117:94,top=40,height=top+5*rowHeight+25;
  const sx=value=>left+value/100*plotWidth;
  let markup=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="compare-svg-title compare-svg-description"><title id="compare-svg-title">${text(a.model)} versus ${text(b.model)} across five metadata fields</title><desc id="compare-svg-description">Forest green represents ${text(a.model)}. Terracotta represents ${text(b.model)}. Percentage scale begins at zero and ends at 100. Field-specific confidence intervals are not reported. ${['title','culture','period','origin','creator'].map(key=>`${labels[key]}: ${text(a.model)} ${format(a[key])} percent; ${text(b.model)} ${format(b[key])} percent.`).join(' ')}</desc>`;
  for(let tick=0;tick<=100;tick+=20){const x=sx(tick);markup+=`<line x1="${x}" y1="${top-7}" x2="${x}" y2="${height-20}" stroke="#c3c5b8" stroke-width="1"/>`+svgText(x,20,`${tick}%`,`text-anchor="${tick===0?'start':tick===100?'end':'middle'}" font-size="${compact?13:17}" fill="#62685b"`);}
  ['title','culture','period','origin','creator'].forEach((key,index)=>{
    const y=top+index*rowHeight;
    markup+=svgText(compact?left:5,compact?y+18:y+40,labels[key],`font-size="${compact?20:23}" fill="#21482D"`);
    [a,b].forEach((row,modelIndex)=>{
      const yy=y+(compact?35:12)+modelIndex*28;
      const value=row[key];
      markup+=`<g><title>${text(row.model)}: ${labels[key]} ${format(value)} percent</title><rect x="${left}" y="${yy}" width="${sx(value)-left}" height="19" rx="3" fill="${chartColors[modelIndex]}"/><circle cx="${sx(value)}" cy="${yy+9.5}" r="4" fill="${chartColors[modelIndex]}"/>`+svgText(sx(value)+11,yy+16,`${format(value)}%`,`font-size="${compact?15:20}" fill="${chartColors[modelIndex]}"`)+`</g>`;
    });
  });
  container.innerHTML=markup+'</svg>';
}

function configureInteractions() {
  document.addEventListener('click',event => {
    const objectButton = event.target.closest('[data-object]');
    if (objectButton) openObject(objectButton.dataset.object);
    const row = event.target.closest('[data-rank-model]');
    if (row) selectModel(row.dataset.rankModel);
    const metric = event.target.closest('[data-metric]');
    if (metric) {sortMetric=metric.dataset.metric;sortDirection=-1;$('#chart-tooltip').hidden=true;renderLeaderboard();}
  });
  $('#ranking-chart').addEventListener('keydown',event=>{const row=event.target.closest('[data-rank-model]');if(row&&(event.key==='Enter'||event.key===' ')){event.preventDefault();selectModel(row.dataset.rankModel);}});
  $('#ranking-chart').addEventListener('pointerover',event=>{const row=event.target.closest('[data-rank-model]');if(row&&event.pointerType!=='touch')showChartTooltip(row,event);});
  $('#ranking-chart').addEventListener('pointermove',event=>{const row=event.target.closest('[data-rank-model]');if(row&&event.pointerType!=='touch')showChartTooltip(row,event);});
  $('#ranking-chart').addEventListener('pointerleave',()=>{$('#chart-tooltip').hidden=true;});
  $('#ranking-chart').addEventListener('focusin',event=>{const row=event.target.closest('[data-rank-model]');if(row)showChartTooltip(row);});
  $('#ranking-chart').addEventListener('focusout',()=>{$('#chart-tooltip').hidden=true;});
  $('#sort-toggle').addEventListener('click',()=>{sortDirection=-sortDirection;renderLeaderboard();});
  $('#comparison-selectors').addEventListener('change',event=>{const select=event.target.closest('[data-compare-index]');if(!select)return;const i=Number(select.dataset.compareIndex),other=1-i;const old=selectedModels[i];if(selectedModels[other]===select.value)selectedModels[other]=old;selectedModels[i]=select.value;renderLeaderboard();renderComparison();});
  $('#reset-comparison').addEventListener('click',()=>{selectedModels=['Qwen3-VL-Flash','GPT-5.4-mini'];renderLeaderboard();renderComparison();});
  for (const selector of ['#region-filter','#type-filter','#museum-filter']) $(selector).addEventListener('change',filterCollection);
  $('#gallery-search').addEventListener('input',filterCollection);
  $('#reset-filters').addEventListener('click',() => {for (const selector of ['#region-filter','#type-filter','#museum-filter','#gallery-search']) $(selector).value = '';filterCollection();});
  $('#load-more').addEventListener('click',() => {visibleLimit += 12;renderGallery();});
  $('#discover-button').addEventListener('click',() => {if(filteredObjects.length)openObject(filteredObjects[Math.floor(Math.random()*filteredObjects.length)].id);});
  $('#gallery-view-grid').addEventListener('click',() => {stopTour();setGalleryView('grid');});
  $('#gallery-view-strip').addEventListener('click',() => {stopTour();setGalleryView('strip');});
  $('#motion-toggle').addEventListener('click',toggleTour);
  $('#gallery-grid').addEventListener('pointerdown',() => {if(tourTimer)stopTour();});
  $('#gallery-grid').addEventListener('keydown',() => {if(tourTimer)stopTour();});
  $('#object-dialog .dialog-close').addEventListener('click',() => $('#object-dialog').close());
  $('#object-dialog').addEventListener('click',event => {const rect=$('#object-dialog').getBoundingClientRect();if(event.target === $('#object-dialog') && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom))$('#object-dialog').close();});
  $('#previous-object').addEventListener('click',() => navigateObject(-1));
  $('#next-object').addEventListener('click',() => navigateObject(1));
  $('#object-dialog').addEventListener('keydown',event => {if(event.key === 'ArrowLeft'){event.preventDefault();navigateObject(-1);}if(event.key === 'ArrowRight'){event.preventDefault();navigateObject(1);}});
  $('#model-search').addEventListener('input',()=>{$('#chart-tooltip').hidden=true;renderLeaderboard();});
  $('#copy-citation').addEventListener('click',async () => {try{await navigator.clipboard.writeText($('#citation-text').textContent);$('#citation-status').textContent='Citation copied.';}catch{$('.citation').open=true;$('#citation-status').textContent='Select and copy the citation below.';}});
  document.addEventListener('visibilitychange',() => {if(document.hidden)stopTour();});
  reducedMotion.addEventListener('change',stopTour);
}

configureInteractions();
Promise.allSettled([getJSON('data/gallery.json'),getJSON('data/leaderboard.json')]).then(results => {
  const [gallery,leaderboard] = results;
  if (gallery.status === 'fulfilled') {collection=Array.isArray(gallery.value)?gallery.value:gallery.value.objects;initializeFilters();selectHeroObjects();filterCollection();}
  else {$('#gallery-count').textContent='The collection could not be loaded. Please reload or browse the dataset on Hugging Face.';$('#discover-button').disabled=true;$('#motion-toggle').disabled=true;}
  if (leaderboard.status === 'fulfilled') {tableData=leaderboard.value;renderLeaderboard();renderComparison();let lastWidth=0;new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-lastWidth)>2){lastWidth=width;renderLeaderboard();renderComparison();}}).observe($('#ranking-chart'));}
  else {$('#ranking-chart').innerHTML='<p>The results could not be loaded. Please reload or use the downloadable dataset.</p>';}
});
