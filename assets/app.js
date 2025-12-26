window.ScriptUtils=(function(){
  const LS_KEY_BUNDLE = 'bundle_texts';
  const LS_KEY_ONDERDELEN = 'onderdelen_list';

  function defaultOnderdelen(){
    return ["500 Meter WOMEN", "500 Meter MEN", "1000 Meter WOMEN", "1000 Meter MEN", "1500 Meter WOMEN", "1500 Meter MEN", "3000 Meter WOMEN", "5000 Meter WOMEN", "5000 Meter MEN", "10000 Meter MEN", "Mass Start WOMEN", "Mass Start MEN", "Team Sprint WOMEN", "Team Sprint MEN"];
  }

  function normalizeOnderdeelName(name){
    let s = String(name ?? '').trim();
    if(!s) return '';
    // Normalize common Dutch -> English / rename event
    s = s.replace(/team\s*pursuit/ig,'Team Sprint');
    s = s.replace(/\bvrouwen\b/ig,'WOMEN').replace(/\bvrouw\b/ig,'WOMEN');
    s = s.replace(/\bmannen\b/ig,'MEN').replace(/\bman\b/ig,'MEN');
    // Also handle already-uppercase variants
    s = s.replace(/\bVROUWEN\b/g,'WOMEN').replace(/\bMANNEN\b/g,'MEN');
    s = s.replace(/Team\s+Pursuit/ig,'Team Sprint');
    // Collapse whitespace
    s = s.replace(/\s+/g,' ').trim();
    return s;
  }

  function canonicalOnderdeel(name){
    return normalizeOnderdeelName(name).toUpperCase();
  }

  function getOnderdelen(){
    try{
      const raw = localStorage.getItem(LS_KEY_ONDERDELEN);
      const parsed = JSON.parse(raw || 'null');
      if(Array.isArray(parsed) && parsed.length){
        const cleaned = parsed.map(normalizeOnderdeelName).filter(Boolean);
        // If normalization changed anything, persist the normalized list
        if(JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
          localStorage.setItem(LS_KEY_ONDERDELEN, JSON.stringify(cleaned));
        }
        return cleaned.length ? cleaned : defaultOnderdelen();
      }
    }catch(e){}
    return defaultOnderdelen();
  }

  function setOnderdelen(list){
    const arr = Array.isArray(list) ? list : [];
    const cleaned = arr.map(normalizeOnderdeelName).filter(Boolean);
    // dedupe while preserving order
    const seen = new Set();
    const uniq = [];
    for(const it of cleaned){
      const key = it.toUpperCase();
      if(!seen.has(key)){ seen.add(key); uniq.push(it); }
    }
    const finalList = uniq.length ? uniq : defaultOnderdelen();
    localStorage.setItem(LS_KEY_ONDERDELEN, JSON.stringify(finalList));
    return finalList;
  }

  function resetOnderdelen(){
    const d = defaultOnderdelen();
    localStorage.setItem(LS_KEY_ONDERDELEN, JSON.stringify(d));
    return d;
  }

  function getBundleTexts(){
    const defaults={
      prijsuitreiking:'PRIJSUITREIKING DAIKIN NK AFSTANDEN {onderdeel}.',
      brons_1:'DE BRONZEN MEDAILLE, MET EEN TIJD VAN {tijd}.',
      brons_2:'NAMENS {team}',
      brons_3:'{naam}',
      zilver_1:'DE ZILVEREN MEDAILLE, MET EEN TIJD VAN {tijd}.',
      zilver_2:'NAMENS {team}',
      zilver_3:'{naam}',
      goud_1:'EN HET GOUD VOOR DE WINNAAR VAN DEZE {onderdeel}.',
      goud_2:'MET EEN TIJD VAN {tijd}.',
      goud_3:'NAMENS {team}',
      goud_4:'{naam}',
      uit_medailles:'DE MEDAILLES WORDEN UITGEREIKT DOOR {naam_functie}.',
      uit_bloemen:'DE BLOEMEN EN CADEAUTJES WORDEN UITGEREIKT DOOR {naam_functie}.',
      volkslied:'THIALF, GAAT U STAAN EN GRAAG UW AANDACHT VOOR HET NATIONALE VOLKSLIED: HET WILHELMUS.',
      applaus:'GEEF ZE NOG EEN GROOT APPLAUS, HET PODIUM VAN DEZE {onderdeel}.',
      podium_3:'DERDE PLAATS: {naam}',
      podium_2:'TWEEDE PLAATS: {naam}',
      podium_1:'EERSTE PLAATS: {naam} (NEDERLANDS KAMPIOEN)'
    };
    try{
      const saved = JSON.parse(localStorage.getItem(LS_KEY_BUNDLE) || '{}') || {};
      return Object.assign({}, defaults, saved);
    }catch(e){
      return defaults;
    }
  }

  function setBundleTexts(obj){ localStorage.setItem(LS_KEY_BUNDLE, JSON.stringify(obj||{})); }

  function format(tpl,map){ return tpl.replace(/{\s*([\w_]+)\s*}/g,(_,k)=>(map[k]??'')); }

  function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  function formatRich(tpl,map){
    const plain = format(tpl, map||{});
    let html = escapeHtml(plain);
    html = html.replace(/\*\*(.+?)\*\*/g,'<em>$1</em>');
    html = html.replace(/__(.+?)__/g,'<strong>$1</strong>');
    return html;
  }

  function keyFor(onderdeel){ return 'fields:' + canonicalOnderdeel(onderdeel); }

  function possibleLegacyKeys(onderdeel){
    const raw = String(onderdeel ?? '');
    const upperRaw = raw.toUpperCase();
    const canon = canonicalOnderdeel(raw);

    const variants = new Set();
    variants.add('fields:' + canon);
    variants.add('fields:' + upperRaw);

    // Generate token variants (MEN<->MANNEN, WOMEN<->VROUWEN, TEAM SPRINT<->TEAM PURSUIT)
    function addVariant(str){
      if(str) variants.add('fields:' + str);
    }

    const swapPairs = [
      ['WOMEN','VROUWEN'],
      ['MEN','MANNEN'],
      ['TEAM SPRINT','TEAM PURSUIT'],
    ];

    // Start from canonical and raw forms
    const bases = [canon, upperRaw].filter(Boolean);
    for(const base of bases){
      addVariant(base);
      for(const [a,b] of swapPairs){
        if(base.includes(a)) addVariant(base.replaceAll(a,b));
        if(base.includes(b)) addVariant(base.replaceAll(b,a));
      }
      // combinations (2 swaps)
      for(const [a1,b1] of swapPairs){
        for(const [a2,b2] of swapPairs){
          let s = base;
          if(s.includes(a1)) s = s.replaceAll(a1,b1);
          if(s.includes(a2)) s = s.replaceAll(a2,b2);
          addVariant(s);
        }
      }
    }
    return Array.from(variants);
  }

  function readData(onderdeel){
    try{
      const keys = possibleLegacyKeys(onderdeel);
      const canonKey = keyFor(onderdeel);
      for(const k of keys){
        const raw = localStorage.getItem(k);
        if(raw != null){
          let parsed={};
          try{ parsed = JSON.parse(raw||'{}') || {}; }catch(e){ parsed={}; }
          // migrate to canonical key if needed
          if(k !== canonKey){
            localStorage.setItem(canonKey, JSON.stringify(parsed||{}));
          }
          return parsed || {};
        }
      }
      return {};
    }catch(e){
      return {};
    }
  }

  function writeData(onderdeel,data){
    localStorage.setItem(keyFor(onderdeel), JSON.stringify(data||{}));
  }

  function allOnderdeelKeys(){
    // Backwards compatible name used in existing pages
    return getOnderdelen();
  }

  function exportAll(){
    const out = {
      version: 1,
      exportedAt: new Date().toISOString(),
      onderdelen: getOnderdelen(),
      bundle_texts: getBundleTexts(),
      fields: {}
    };
    // Export all stored fields (including ones not in the onderdelen list)
    try{
      for(let i=0;i<localStorage.length;i++) {
        const k = localStorage.key(i);
        if(k && k.startsWith('fields:')) {
          const onderdeelKey = k.slice('fields:'.length);
          try {
            out.fields[onderdeelKey] = JSON.parse(localStorage.getItem(k) || '{}') || {};
          } catch(e) {
            out.fields[onderdeelKey] = {};
          }
        }
      }
    }catch(e){}
    return out;
  }

  function importAll(obj, {clearExisting=true}={}){
    if(!obj || typeof obj !== 'object') throw new Error('Ongeldig JSON-bestand.');
    const onderdelen = obj.onderdelen || obj.Onderdelen || obj.parts;
    const bundle = obj.bundle_texts || obj.bundleTexts || obj.texts;
    const fields = obj.fields || obj.onderdeelData || obj.data;

    if(Array.isArray(onderdelen)) setOnderdelen(onderdelen);

    if(bundle && typeof bundle === 'object') {
      // store only overrides relative to defaults? easiest: store full bundle
      setBundleTexts(bundle);
    }

    if(fields && typeof fields === 'object') {
      if(clearExisting) {
        // Remove all existing fields: keys
        const toRemove = [];
        for(let i=0;i<localStorage.length;i++) {
          const k = localStorage.key(i);
          if(k && k.startsWith('fields:')) toRemove.push(k);
        }
        toRemove.forEach(k=>localStorage.removeItem(k));
      }
      for(const [onderdeelKey,val] of Object.entries(fields)) {
        const k = 'fields:' + String(onderdeelKey).toUpperCase();
        localStorage.setItem(k, JSON.stringify(val||{}));
      }
    }
    return true;
  }

  return {
    getBundleTexts, setBundleTexts,
    format, formatRich,
    normalizeOnderdeelName, canonicalOnderdeel,
    getOnderdelen, setOnderdelen, resetOnderdelen,
    keyFor, readData, writeData,
    allOnderdeelKeys,
    exportAll, importAll
  };
})();
