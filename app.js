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
let tableData = null, sortMetric = 'acc', sortDirection = -1, tableView = 'overall';
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

function cell(row,key,pooled = false) {
  if (row[key] === undefined) return '<td>—</td>';
  if (key === 'valid' || key === 'invalid') return `<td${key === sortMetric ? ' class="sort-cell"' : ''}>${row[key].toLocaleString('en-US')}</td>`;
  const ci = row.ci?.[key];
  return `<td class="metric-cell${key === sortMetric ? ' sort-cell' : ''}"><span class="metric-value">${format(row[key])}</span>${ci ? `<span class="ci">[${format(ci[0])}, ${format(ci[1])}]</span>` : ''}${key === sortMetric && !pooled ? `<span class="mini-bar" style="--bar-width:${row[key]}%" aria-hidden="true"></span>` : ''}</td>`;
}

function renderLeaderboard() {
  if (!tableData) return;
  const fields = tableView === 'fields' ? ['title','culture','period','origin','creator','mean','ctx','acc','valid','invalid'] : ['mean','ctx','acc','valid','invalid'];
  const query = $('#model-search').value.toLocaleLowerCase().trim();
  const rows = tableData.rows.filter(r => r.model.toLocaleLowerCase().includes(query)).sort((a,b) => (a[sortMetric] - b[sortMetric]) * sortDirection || a.model.localeCompare(b.model));
  $('#results-head').innerHTML = `<tr><th scope="col">#</th><th scope="col">Model endpoint</th>${fields.map(key => `<th scope="col" aria-sort="${key === sortMetric ? sortDirection === -1 ? 'descending' : 'ascending' : 'none'}"><button type="button" data-sort="${key}" aria-pressed="${key === sortMetric}" aria-label="Sort by ${labels[key]}">${labels[key]} <span aria-hidden="true">${key === sortMetric ? sortDirection === -1 ? '↓' : '↑' : '↕'}</span></button></th>`).join('')}</tr>`;
  $('#results-body').innerHTML = rows.length ? rows.map((row,i) => `<tr tabindex="0" data-model="${text(row.model)}" aria-label="${text(row.model)}; ${labels[sortMetric]} ${format(row[sortMetric])}${sortMetric === 'valid' || sortMetric === 'invalid' ? '' : ' percent'}; press Enter for profile"><td>${String(i+1).padStart(2,'0')}</td><td>${text(row.model)}</td>${fields.map(key => cell(row,key)).join('')}</tr>`).join('') : `<tr><td colspan="${fields.length+2}">No model endpoints match your search.</td></tr>`;
  $('#results-foot').innerHTML = `<tr><td>—</td><td>Pooled</td>${fields.map(key => cell(tableData.pooled,key,true)).join('')}</tr>`;
  $('#leaderboard-status').textContent = `${rows.length} endpoints, sorted by ${labels[sortMetric]}, ${sortDirection === -1 ? 'highest first' : 'lowest first'}.`;
}

function showProfile(model) {
  const row = tableData.rows.find(r => r.model === model);
  if (!row) return;
  const profile = $('#model-profile');
  profile.hidden = false;
  profile.innerHTML = `<div class="profile-heading"><h3>${text(row.model)}</h3><button type="button" class="plain-button" id="close-profile" aria-label="Close model profile">Close ×</button></div><p class="method-note">${row.valid} valid outputs · ${row.invalid} invalid · ${format(row.acc)}% complete-record compatibility · ${format(row.ctx)}% contextual compatibility</p><div class="profile-bars">${['title','culture','period','origin','creator'].map(key => `<div><div class="profile-label"><span>${labels[key]}</span><b>${format(row[key])}%</b></div><div class="profile-track"><span style="--bar-width:${row[key]}%"></span></div></div>`).join('')}</div>`;
  for (const tr of document.querySelectorAll('[data-model]')) tr.setAttribute('aria-selected',String(tr.dataset.model === model));
  $('#close-profile').addEventListener('click',() => {profile.hidden = true; for (const tr of document.querySelectorAll('[data-model]')) tr.removeAttribute('aria-selected');});
}

function configureInteractions() {
  document.addEventListener('click',event => {
    const objectButton = event.target.closest('[data-object]');
    if (objectButton) openObject(objectButton.dataset.object);
    const sortButton = event.target.closest('[data-sort]');
    if (sortButton) {
      const metric = sortButton.dataset.sort;
      sortDirection = metric === sortMetric ? -sortDirection : -1;
      sortMetric = metric;
      $('#metric-select').value = metric;
      renderLeaderboard();
    }
    const row = event.target.closest('[data-model]');
    if (row) showProfile(row.dataset.model);
  });
  $('#results-table').addEventListener('keydown',event => {if (event.key === 'Enter' || event.key === ' ') {const row=event.target.closest('[data-model]');if(row){event.preventDefault();showProfile(row.dataset.model);}}});
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
  for (const button of document.querySelectorAll('[data-table-view]')) button.addEventListener('click',() => {tableView=button.dataset.tableView;for(const item of document.querySelectorAll('[data-table-view]')){const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));}renderLeaderboard();});
  $('#metric-select').addEventListener('change',() => {sortMetric=$('#metric-select').value;sortDirection=-1;if(!['mean','ctx','acc','valid','invalid'].includes(sortMetric)){tableView='fields';for(const item of document.querySelectorAll('[data-table-view]')){const active=item.dataset.tableView===tableView;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active));}}renderLeaderboard();});
  $('#model-search').addEventListener('input',renderLeaderboard);
  $('#copy-citation').addEventListener('click',async () => {try{await navigator.clipboard.writeText($('#citation-text').textContent);$('#citation-status').textContent='Citation copied.';}catch{$('.citation').open=true;$('#citation-status').textContent='Select and copy the citation below.';}});
  document.addEventListener('visibilitychange',() => {if(document.hidden)stopTour();});
  reducedMotion.addEventListener('change',stopTour);
}

configureInteractions();
Promise.allSettled([getJSON('data/gallery.json'),getJSON('data/leaderboard.json')]).then(results => {
  const [gallery,leaderboard] = results;
  if (gallery.status === 'fulfilled') {collection=Array.isArray(gallery.value)?gallery.value:gallery.value.objects;initializeFilters();selectHeroObjects();filterCollection();}
  else {$('#gallery-count').textContent='The collection could not be loaded. Please reload or browse the dataset on Hugging Face.';$('#discover-button').disabled=true;$('#motion-toggle').disabled=true;}
  if (leaderboard.status === 'fulfilled') {tableData=leaderboard.value;renderLeaderboard();}
  else {$('#results-body').innerHTML='<tr><td>The results could not be loaded. Please reload or use the downloadable dataset.</td></tr>';}
});
