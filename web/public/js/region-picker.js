/*
 * Taginfo Region Picker — made by vl4dC
 * Zeigt die vorhandenen Taginfo-Regionen als Dropdown mit mehreren Ebenen.
 * context.instances enthält alle Regionen; context.instance ist die aktuelle Region.
 */
(function () {
  'use strict';
  // Manche Regionsnamen enthalten HTML-Zusätze. Im Dropdown zeigen wir nur den Namen.
  const clean = value => String(value).split('<')[0].trim();

  // Baut die Adresse der neuen Region und behält die aktuelle Unterseite bei.
  // Beispiel: /africa:algeria/keys → /africa:angola/keys
  function destination(slug, current, location) {
    const prefix = '/' + current;
    const path = current && (location.pathname === prefix || location.pathname.startsWith(prefix + '/'))
      ? location.pathname.slice(prefix.length) : '/';
    return '/' + slug.split(':').map(encodeURIComponent).join(':') + path + location.search + location.hash;
  }

  // Erstellt das Dropdown im vorhandenen <form id="set_instance"> von Taginfo.
  function mount(form, context, options = {}) {
    if (!form || !context || !context.instances) return;
    const de = document.documentElement.lang.startsWith('de');
    const t = de
      ? {region:'Region auswählen', back:'Zurück', close:'Schließen', levels:['Kontinent','Land','Bundesland / Region','Stadt / Bezirk'], title:'Wo möchtest du entdecken?', intro:'Wähle zuerst einen Kontinent.', search:'In dieser Ebene suchen …', empty:'Keine Regionen gefunden.', open:'Diese Region auswählen', available:'verfügbare Regionen', root:'Welt', hint:'Region auswählen', selected:'Aktuelle Region'}
      : {region:'Choose region',back:'Back',close:'Close',levels:['Continent','Country','State / region','City / district'],title:'Select continent',intro:'Start by choosing a continent.',search:'Search this level …',empty:'No regions found.',open:'Select this region',available:'available regions',root:'World',hint:'Choose region',selected:'Current region'};
    const root = {slug:'',name:t.root,children:[],actual:false};
    const nodes = new Map([['',root]]);
    // Ein Doppelpunkt bedeutet eine weitere Ebene: africa:algeria → Africa → Algeria.
    // Die Liste wird aus Taginfos echten Instanzen gebaut, nicht aus festen Demo-Daten.
    Object.entries(context.instances).sort(([a],[b]) => a.localeCompare(b)).forEach(([slug,label]) => {
      if (slug.startsWith('north-america:us-')) return; // Preserve the original template's exclusion.
      let parent = root;
      slug.split(':').forEach((part,index,parts) => {
        const key = parts.slice(0,index+1).join(':');
        let node = nodes.get(key);
        if (!node) { node = {slug:key,name:part.replace(/-/g,' '),children:[],parent,actual:false}; nodes.set(key,node); parent.children.push(node); }
        if (key === slug) { node.name = clean(label); node.actual = true; }
        parent = node;
      });
    });
    nodes.forEach(node => node.children.sort((a,b)=>a.name.localeCompare(b.name,document.documentElement.lang)));
    form.classList.add('region-picker');
    // Diese festen HTML-Elemente bilden den Knopf und das Panel. Regionsnamen
    // werden später als Text eingesetzt, damit sie keinen HTML-Code ausführen.
    form.innerHTML = `
      <button class="rp-trigger" type="button" aria-expanded="false" aria-haspopup="dialog">
        <span class="rp-globe" aria-hidden="true">◎</span>
        <span class="rp-trigger-copy"><small>${t.selected}</small><strong></strong></span>
        <span class="rp-chevron" aria-hidden="true">⌄</span>
      </button>
      <section class="rp-panel" role="dialog" aria-label="${t.region}" hidden>
        <div class="rp-top">
          <button type="button" class="rp-back">← ${t.back}</button>
          <span class="rp-step"></span>
          <button type="button" class="rp-close" aria-label="${t.close}">×</button>
        </div>
        <div class="rp-heading"><div class="rp-crumb"></div><h2></h2><p></p></div>
        <div class="rp-search"><span aria-hidden="true">⌕</span>
          <input type="search" aria-label="${t.search}" placeholder="${t.search}" autocomplete="off">
        </div>
        <div class="rp-list"></div>
        <div class="rp-bottom">
          <span class="rp-hint"></span>
          <button type="button" class="rp-apply">${t.open} <span aria-hidden="true">↗</span></button>
        </div>
        <div class="rp-status" role="status" aria-live="polite"></div>
      </section>`
    const $ = selector => form.querySelector(selector);
    const trigger = $('.rp-trigger'), panel = $('.rp-panel'), search = $('input'), list = $('.rp-list');
    let node = root;
    const updateLabel = () => { $('.rp-trigger strong').textContent = clean(context.instances[context.instance] || t.root); };
    function close(focus = true) { panel.hidden = true; trigger.setAttribute('aria-expanded','false'); if(focus) trigger.focus(); }
    function select(region) {
      if (!region.actual) return;
      // Auf der echten Taginfo-Seite öffnen wir die gewählte Region im selben Tab.
      // options.onSelect wird nur für eigenständige Vorschauen verwendet.
      if (options.onSelect) { options.onSelect(region.slug,destination(region.slug,context.instance,window.location)); context.instance = region.slug; updateLabel(); close(); }
      else window.location.assign(destination(region.slug,context.instance,window.location));
    }

    // Zeigt nur die Einträge der aktuellen Ebene; die Suche filtert genau diese Liste.
    function renderList() {
      list.textContent = '';
      const matches = node.children.filter(n=>n.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()));
      for (const child of matches) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'rp-option';
        const mark = document.createElement('span'); mark.className = 'rp-mark'; mark.textContent = child.slug === context.instance ? '✓' : child.parent === root ? '◎' : '⌖';
        const copy = document.createElement('span'); copy.className = 'rp-option-copy';
        const name = document.createElement('strong'); name.textContent = child.name; copy.append(name);
        if(child.children.length) { const detail = document.createElement('small'); detail.textContent = `${child.children.length} ${t.available}`; copy.append(detail); }
        const arrow = document.createElement('span'); arrow.className = 'rp-arrow'; arrow.textContent = child.children.length ? '›' : '↗';
        button.append(mark,copy,arrow); button.addEventListener('click',()=>child.children.length ? enter(child) : select(child)); list.append(button);
      }
      if (!matches.length) { const empty = document.createElement('p'); empty.className = 'rp-empty'; empty.textContent = t.empty; list.append(empty); }
      $('.rp-status').textContent = `${matches.length} ${t.available}`;
    }

    // Wechselt eine Ebene weiter und aktualisiert Titel, Zurücknopf und Liste.
    function enter(next, focus = true) {
      node = next; search.value = '';
      const depth = node === root ? 0 : node.slug.split(':').length;
      $('.rp-back').disabled = node === root;
      $('.rp-step').textContent = t.levels[Math.min(depth,3)];
      $('.rp-crumb').textContent = node === root ? t.root : [t.root,...node.slug.split(':').map((_,i,a)=>nodes.get(a.slice(0,i+1).join(':')).name)].join('  /  ');
      $('h2').textContent = node === root ? t.title : node.name;
      $('.rp-heading p').textContent = node === root ? t.intro : de ? 'Entdecke eine Region oder wähle das gesamte Gebiet.' : 'Explore a region or select the entire area.';
      $('.rp-apply').hidden = !node.actual;
      $('.rp-hint').textContent = node.actual ? node.name : t.hint;
      renderList(); list.scrollTop = 0; if(focus) search.focus();
    }
    // Öffnen, Schließen, Zurück, Suche und Tastatursteuerung.
    trigger.addEventListener('click',()=>{ if(!panel.hidden) return close(); panel.hidden=false; trigger.setAttribute('aria-expanded','true'); enter(root); });
    $('.rp-close').addEventListener('click',()=>close());
    $('.rp-back').addEventListener('click',()=>enter(node.parent || root));
    $('.rp-apply').addEventListener('click',()=>select(node));
    search.addEventListener('input',renderList);
    form.addEventListener('submit',event=>event.preventDefault());
    form.addEventListener('keydown',event=>{
      if(panel.hidden) return;
      if(event.key==='Escape') {event.preventDefault();close();}
      const rows = Array.from(list.querySelectorAll('button')); const index = rows.indexOf(document.activeElement);
      if(event.key==='ArrowDown' || event.key==='ArrowUp') {event.preventDefault(); if(rows.length) rows[(index+(event.key==='ArrowDown'?1:rows.length-1))%rows.length].focus();}
      if(event.key==='ArrowLeft' && index>=0 && node.parent) {event.preventDefault();enter(node.parent);}
    });
    document.addEventListener('pointerdown',event=>{if(!panel.hidden && !form.contains(event.target)) close(false);});
    form.addEventListener('focusout',()=>setTimeout(()=>{if(!panel.hidden && !form.contains(document.activeElement))close(false);},0));
    updateLabel(); enter(root,false);
    return {close};
  }

  // Erstellt die Regionsübersicht auf der Taginfo-Startseite ohne HTML aus Daten zusammenzubauen.
  function renderIndexList(container, context) {
    if (!container || !context || !context.instances) return;
    const root = document.createElement('ul');
    const groups = new Map([['', root]]);
    Object.keys(context.instances).sort().forEach(slug => {
      if (slug.startsWith('north-america:us-')) return;
      const parentSlug = slug.includes(':') ? slug.slice(0, slug.lastIndexOf(':')) : '';
      const parent = groups.get(parentSlug) || root;
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '/' + slug.split(':').map(encodeURIComponent).join(':');
      link.textContent = clean(context.instances[slug]);
      item.append(link);
      parent.append(item);
      const children = document.createElement('ul');
      item.append(children);
      groups.set(slug, children);
    });
    container.textContent = '';
    container.appendChild(root);
  }
  window.TaginfoRegionPicker = {mount,destination,renderIndexList};
})();
