const T = "case_annunci";

const STATI=["Nuove","Interessanti","Contattate","Visita fissata","Viste","Scartate"];
const CRIT=[["sud","Esposizione a sud"],["classe","Classe energetica A–C"],["balcone","Balcone"],["noCond","Senza condominio"],["bagni2","Secondo bagno"],["infissi","Infissi/impianti recenti"],["sotto140","Prezzo sotto 140.000 €"],["mq80","Almeno 80 m²"]];
const PRO=["Ottima esposizione","Molto luminosa","Pronta da abitare","Box comodo","Bel balcone/terrazzo","Giardino","Zona tranquilla","Vicina ai servizi","Ottimo prezzo","Poche spese","Classe energetica buona","Spazi ben distribuiti","Studio perfetto"];
const CONTRO=["Da sistemare","Infissi vecchi","Arredamento vecchio","Poco sole","Spese alte","Piano alto senza ascensore","Zona trafficata","Prezzo alto","Stanze piccole"];

let houses=[],view="home",tab="Nuove",openId=null,favMode="lista",me="";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=n=>n?Number(n).toLocaleString("it-IT")+" €":"—";
const score=h=>{const m=h.match||{};return CRIT.filter(c=>m[c[0]]===true).length+"/"+CRIT.length};
const fmtD=d=>new Date(d+"T12:00").toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"});
const now=()=>new Date().toLocaleString("it-IT",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const today=()=>new Date().toISOString().slice(0,10);
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("on"),1800)}

/* ---------- Accesso con PIN ---------- */
let sb=null;
function client(pin){return supabase.createClient(CASE_CONFIG.url,CASE_CONFIG.key,{auth:{persistSession:false},global:{headers:{"x-pin":pin}}})}
async function enter(pin){
  sb=client(pin);
  const {data,error}=await sb.from(T).select("id").limit(1);
  if(error||!data||!data.length){$("#lmsg").textContent="PIN non corretto";return false}
  try{localStorage.setItem("casePin",pin)}catch(e){}
  try{me=localStorage.getItem("chi")||""}catch(e){}
  if(!me){me=confirm("Sei Nicole? (Annulla = Simone)")?"Nicole":"Simone";try{localStorage.setItem("chi",me)}catch(e){}}
  $("#me").textContent=me+" ⇄";
  $("#login").hidden=true;$("#app").hidden=false;
  await load();setInterval(()=>{if(!document.hidden)load()},15000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
  return true;
}
function tryPin(){const p=$("#em").value.trim();if(p)enter(p)}
function switchMe(){me=me=="Nicole"?"Simone":"Nicole";try{localStorage.setItem("chi",me)}catch(e){}$("#me").textContent=me+" ⇄";toast("Ora scrivi come "+me)}
async function load(){
  const {data,error}=await sb.from(T).select("id,data");
  if(error){$("#subtitle").textContent="Errore nel caricamento dei dati";return}
  houses=data.map(r=>({id:r.id,...r.data}));render();
  if(openId&&!document.activeElement.matches("textarea,input"))openH(openId);
}
const strip=h=>{const {id,...d}=h;return d};

async function save(id,patch){
  const h=houses.find(x=>x.id==id);if(!h)return;Object.assign(h,patch);render();if(openId==id)openH(id);
  const {error}=await sb.from(T).update({data:strip(h),updated_at:new Date().toISOString()}).eq("id",id);
  if(error)toast("Errore nel salvataggio, riprova");
}

/* ---------- Interfaccia ---------- */

function tagsHtml(h){const p=h.pro||[],c=h.contro||[];if(!p.length&&!c.length)return"";return `<div>${p.map(t=>`<span class="tg">+ ${esc(t)}</span>`).join("")}${c.map(t=>`<span class="tg c">− ${esc(t)}</span>`).join("")}</div>`}
function card(h){
  const f=h.foto&&h.foto[0];
  const contatto=h.stato=="Contattate"&&h.contattoData?`<span class="flag">Contattata ${fmtD(h.contattoData)}</span>`:"";
  const vis=h.visita?`<span class="flag">Visita ${fmtD(h.visita.data)} · ${esc(h.visita.ora)}</span>`:"";
  const nrisp=h.stato=="Contattate"&&h.contattoData&&(Date.now()-new Date(h.contattoData))>3*864e5?`<span class="flag">Nessuna risposta: ricontattare?</span>`:"";
  const simo=h.preferitoSimone?`<span class="flag">★ di Simone su Idealista</span>`:"";
  return `<div class="card" onclick="openH('${h.id}')">
  <div class="ph${f?" img":""}" ${f?`style="background-image:url('${esc(f)}')"`:""}><span class="score">${score(h)}</span><span class="tag">${esc(h.fonte||"")}</span>
  <button class="fav" onclick="event.stopPropagation();save('${h.id}',{fav:${!h.fav}})">${h.fav?"★":"☆"}</button>
  <div class="big">${esc(h.comune||"")}</div><div class="typ">${esc(h.tipo||"")} · ${h.locali||"?"} locali · ${h.mq||"?"} m²</div></div>
  <div class="row"><span class="price">${eur(h.prezzo)}</span><span class="muted">${h.prezzo&&h.mq?eur(Math.round(h.prezzo/h.mq))+"/m²":""}</span></div>
  ${keyInfo(h)}<div class="specs">${esc(h.titolo||"")}</div><div class="muted">${esc(h.indirizzo||"")}</div>
  <div>${simo}${contatto}${nrisp}${vis}${h.box?"":`<span class="flag">Box da verificare</span>`}</div>${tagsHtml(h)}</div>`}
function keyInfo(h){
  const sud=/sud/i.test(h.esposizione||"");
  const c=h.classe&&h.classe!="Non indicata"?h.classe:null;
  return `<div class="key"><span class="${c?"on":"nd"}"><small>Classe energetica</small>${esc(c||"Da verificare")}</span><span class="${h.esposizione?(sud?"on sud":"on"):"nd"}"><small>Esposizione</small>${esc(h.esposizione||"Da verificare")}${sud?" ☀":""}</span></div>`;
}
function toggleTag(id,kind,t){const h=houses.find(x=>x.id==id);const a=[...(h[kind]||[])];const i=a.indexOf(t);i>=0?a.splice(i,1):a.push(t);save(id,{[kind]:a})}
function addTag(id,kind){const t=$("#t_"+kind).value.trim();if(!t)return;const h=houses.find(x=>x.id==id);if(!(h[kind]||[]).includes(t))save(id,{[kind]:[...(h[kind]||[]),t]})}
function picker(h,kind,list){const cur=h[kind]||[];const all=[...new Set([...list,...cur])];return `<div class="tagpick">${all.map(t=>`<button class="${kind=="contro"?"c ":""}${cur.includes(t)?"on":""}" onclick="toggleTag('${h.id}','${kind}',${esc(JSON.stringify(t))})">${esc(t)}</button>`).join("")}</div>
 <div class="two"><input id="t_${kind}" placeholder="Altra etichetta…"><button class="btn o s" style="width:auto;padding:9px 14px" onclick="addTag('${h.id}','${kind}')">+</button></div>`}

function render(){
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.v==view));
  const t=$("#tabs"),m=$("#main");
  if(view=="home"){
    const nuove=houses.filter(h=>h.stato=="Nuove").length;
    $("#title").textContent="Case";$("#subtitle").textContent=houses.length?`${houses.filter(h=>h.stato!="Scartate").length} case attive · ${nuove} nuove`:"Nessuna casa ancora";
    t.style.display="flex";
    t.innerHTML=STATI.map(s=>{const n=houses.filter(h=>h.stato==s).length;return `<button class="tab ${s==tab?"on":""}" onclick="tab='${s}';render()">${s}${n?`<i>${n}</i>`:""}</button>`}).join("");
    const l=houses.filter(h=>h.stato==tab).sort((a,b)=>parseInt(score(b))-parseInt(score(a))||(a.prezzo-b.prezzo));
    m.innerHTML=`<div class="list">${l.map(card).join("")||`<div class="empty">Nessuna casa in “${tab}”</div>`}</div>`;
  }else if(view=="fav"){
    $("#title").textContent="Preferite";$("#subtitle").textContent="Le case con la stella";t.style.display="none";
    const l=houses.filter(h=>(h.fav||h.preferitoSimone)&&h.stato!="Scartate");
    const seg=`<div class="seg">${["lista","schede"].map(x=>`<button class="tab ${favMode==x?"on":""}" onclick="favMode='${x}';render()">${x=="lista"?"Riepilogo":"Schede"}</button>`).join("")}</div>`;
    if(!l.length)m.innerHTML=`<div class="empty">Nessuna preferita. Tocca ☆ su una casa.</div>`;
    else if(favMode=="schede")m.innerHTML=seg+`<div class="list">${l.map(card).join("")}</div>`;
    else m.innerHTML=seg+`<div style="padding:4px 20px">${l.map(h=>{const v=h.voti||{};return `<div class="frow" onclick="openH('${h.id}')"><div class="l"><b>${esc(h.comune)}</b> <span class="muted">· ${esc(h.stato)}</span><div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.titolo)}</div>${tagsHtml(h)||`<div class="muted" style="margin-top:6px;font-size:12px">Nessuna etichetta: apri e aggiungi il perché</div>`}</div><div class="r"><div class="price" style="font-size:15px">${eur(h.prezzo)}</div><div class="muted">${score(h)}</div><div class="muted">N ${v.Nicole||"–"} · S ${v.Simone||"–"}</div></div></div>`}).join("")}</div>`;
  }else{
    t.style.display="none";$("#title").textContent="Visite";
    const ev=houses.filter(h=>h.visita&&h.stato!="Scartate").sort((a,b)=>(a.visita.data+a.visita.ora).localeCompare(b.visita.data+b.visita.ora));
    const base=new Date(),y=base.getFullYear(),mo=base.getMonth();
    $("#subtitle").textContent=base.toLocaleDateString("it-IT",{month:"long",year:"numeric"});
    const days=ev.filter(h=>{const d=new Date(h.visita.data);return d.getFullYear()==y&&d.getMonth()==mo}).map(h=>+h.visita.data.slice(8));
    let g=["L","M","M","G","V","S","D"].map(d=>`<div class="dn">${d}</div>`).join("");
    const first=(new Date(y,mo,1).getDay()+6)%7,len=new Date(y,mo+1,0).getDate();
    for(let i=0;i<first;i++)g+="<div></div>";
    for(let d=1;d<=len;d++)g+=`<div class="d ${days.includes(d)?"has":""} ${d==base.getDate()?"today":""}">${d}</div>`;
    const fut=ev.filter(h=>h.visita.data>=today());
    m.innerHTML=`<div class="cal"><div class="mgrid">${g}</div>
    <h3 style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#777;margin:24px 0 4px">Prossime visite</h3>
    ${fut.map(h=>{const d=new Date(h.visita.data+"T12:00");return `<div class="ev" onclick="openH('${h.id}')"><div class="dt"><small>${d.toLocaleDateString("it-IT",{weekday:"short"})}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString("it-IT",{month:"short"})}</small></div><div class="t"><b>${esc(h.visita.ora)}</b> — ${esc(h.titolo)}<span>${esc(h.indirizzo)} · ${eur(h.prezzo)}</span></div></div>`}).join("")||`<div class="empty">Nessuna visita in programma.<br>Aprila da una casa → “Fissa visita”.</div>`}</div>`;
  }
}
const stars=(n,p,id)=>[1,2,3,4,5].map(i=>`<span onclick="vote('${id}','${p}',${i})">${i<=(n||0)?"★":"☆"}</span>`).join("");
function vote(id,p,n){const h=houses.find(x=>x.id==id);save(id,{voti:{...(h.voti||{}),[p]:n}})}
function openH(id){
  openId=id;const h=houses.find(x=>x.id==id);if(!h)return;const m=h.match||{};
  const v=h.voti||{},vals=[v.Nicole,v.Simone].filter(Boolean);
  $("#detail").innerHTML=`<div class="top"><button class="icon" onclick="closeH()">←</button>
   <button class="icon" onclick="save('${h.id}',{fav:${!h.fav}})">${h.fav?"★":"☆"}</button></div>
  ${h.foto&&h.foto.length?`<div class="gal">${h.foto.map(u=>`<img src="${esc(u)}" loading="lazy" referrerpolicy="no-referrer" alt="">`).join("")}</div>`:""}
  <div class="pad"><div class="muted">${esc(h.fonte)} · ${esc(h.comune)}</div>
   <div class="price" style="font-size:28px;margin-top:4px">${eur(h.prezzo)}</div>${keyInfo(h)}
   ${h.prezzoPrima?`<div class="muted">Prima ${eur(h.prezzoPrima)}</div>`:""}
   <div style="font-weight:600;margin-top:6px">${esc(h.titolo)}</div><div class="muted">${esc(h.indirizzo)}</div>
   ${h.descr?`<p style="font-size:14px;color:#444;margin-top:10px;line-height:1.45">${esc(h.descr)}</p>`:""}</div>
  <div class="sec"><a class="btn" href="${esc(h.link)}" target="_blank" rel="noopener">Apri annuncio ↗</a>
   ${h.telefono?`<p class="muted" style="margin-top:10px;text-align:center">Tel. ${esc(h.telefono)}</p>`:""}</div>
  <div class="sec"><h3>Foto</h3><p class="muted" style="margin-bottom:8px">Incolla i link delle immagini (uno per riga).</p>
   <textarea id="ft">${esc((h.foto||[]).join("\n"))}</textarea><button class="btn o s" style="margin-top:8px" onclick="saveFoto('${h.id}')">Salva foto</button></div>
  <div class="sec"><h3>Caratteristiche</h3><div class="grid">
   <div><span>Tipologia</span>${esc(h.tipo||"—")}</div><div><span>Superficie</span>${h.mq||"—"} m²</div>
   <div><span>Locali</span>${h.locali||"—"}</div><div><span>Bagni</span>${h.bagni||"—"}</div>
   <div><span>Esposizione</span>${esc(h.esposizione||"—")}</div><div><span>Piano</span>${esc(h.piano||"—")}</div><div><span>Box</span>${h.box?"Sì":"Da verificare"}</div>
   <div><span>Classe energetica</span>${esc(h.classe||"—")}</div><div><span>Inserzionista</span>${esc(h.inserzionista||"—")}</div></div>
   ${h.dettagli?`<p style="font-size:13px;color:#444;margin-top:12px;line-height:1.5">${esc(h.dettagli)}</p>`:""}</div>
  <div class="sec"><h3>Perché ci piace</h3>${picker(h,"pro",PRO)}</div>
  <div class="sec"><h3>Cosa non ci convince</h3>${picker(h,"contro",CONTRO)}</div>
  <div class="sec"><h3>Compatibilità · ${score(h)}</h3><ul class="match">${CRIT.map(c=>`<li><span>${m[c[0]]===true?"●":m[c[0]]===false?"○":"?"}</span>${c[1]}${m[c[0]]==null?' <span class="muted">da verificare</span>':""}</li>`).join("")}</ul></div>
  <div class="sec"><h3>Stato</h3><div class="pills">${STATI.map(s=>`<button class="pill ${s==h.stato?"on":""}" onclick="setStato('${h.id}','${s}')">${s}</button>`).join("")}</div>
   ${h.contattoData?`<p class="muted" style="margin-top:10px">Contattata il ${fmtD(h.contattoData)} ${h.contattoCanale?"via "+esc(h.contattoCanale):""}</p>`:`<div class="two" style="margin-top:12px">${["Portale","Telefono","WhatsApp"].map(c=>`<button class="btn o s" onclick="contatta('${h.id}','${c}')">Contattata via ${c}</button>`).join("")}</div>`}</div>
  <div class="sec"><h3>Visita</h3>
   ${h.visita?`<p style="margin-bottom:10px;font-size:15px"><b>${fmtD(h.visita.data)} alle ${esc(h.visita.ora)}</b></p>`:""}
   <div class="two"><input type="date" id="vd" value="${h.visita?h.visita.data:""}"><input type="time" id="vo" value="${h.visita?h.visita.ora:"18:00"}"></div>
   <button class="btn o" style="margin-top:8px" onclick="setVisita('${h.id}')">${h.visita?"Sposta visita":"Fissa visita"}</button>
   ${h.visita?`<button class="btn o s" style="margin-top:6px;border-color:#ddd" onclick="save('${h.id}',{visita:null})">Annulla visita</button>`:""}</div>
  <div class="sec"><h3>Il vostro voto${vals.length==2?" · media "+((vals[0]+vals[1])/2).toFixed(1):""}</h3><div class="votes">
   <div class="vote"><small>Nicole</small><div class="stars">${stars(v.Nicole,"Nicole",h.id)}</div></div>
   <div class="vote"><small>Simone</small><div class="stars">${stars(v.Simone,"Simone",h.id)}</div></div></div></div>
  <div class="sec"><h3>Note</h3>${(h.note||[]).map(n=>`<div class="note"><b>${esc(n.chi)}</b><small>${esc(n.q)}</small><br>${esc(n.t)}</div>`).join("")||`<p class="muted" style="margin-bottom:8px">Ancora nessuna nota.</p>`}
   <textarea id="nt" placeholder="Scrivi una nota come ${esc(me)}…" style="margin-top:10px"></textarea>
   <button class="btn o" style="margin-top:8px" onclick="addNote('${h.id}')">Aggiungi nota</button></div>`;
  $("#sheet").classList.add("open");
}
function closeH(){openId=null;$("#sheet").classList.remove("open");render()}
function saveFoto(id){save(id,{foto:$("#ft").value.split(/\s+/).filter(u=>/^https?:\/\//.test(u))});toast("Foto salvate")}
function setStato(id,s){const p={stato:s};const h=houses.find(x=>x.id==id);if(s=="Contattate"&&!h.contattoData)p.contattoData=today();save(id,p);toast(s=="Scartate"?"Scartata: sparisce dalle liste":"Spostata in “"+s+"”")}
function contatta(id,c){save(id,{stato:"Contattate",contattoData:today(),contattoCanale:c});toast("Segnata come contattata")}
function setVisita(id){const d=$("#vd").value,o=$("#vo").value;if(!d||!o){toast("Scegli giorno e ora");return}save(id,{visita:{data:d,ora:o},stato:"Visita fissata"});toast("Visita nel calendario")}
function addNote(id){const t=$("#nt").value.trim();if(!t)return;const h=houses.find(x=>x.id==id);save(id,{note:[...(h.note||[]),{chi:me,t,q:now()}]})}
function openAdd(){
  openId=null;
  $("#detail").innerHTML=`<div class="top"><button class="icon" onclick="closeH()">←</button></div>
  <div class="pad"><h1>Aggiungi casa</h1><p class="muted" style="margin-top:4px">Incolla il link dell'annuncio e i dati principali.</p>
  <label class="lbl">Link annuncio</label><input id="a_link" placeholder="https://www.idealista.it/immobile/…">
  <label class="lbl">Titolo</label><input id="a_tit" placeholder="Trilocale con balcone">
  <div class="two"><div style="flex:1"><label class="lbl">Comune</label><input id="a_com" placeholder="Villorba"></div><div style="flex:1"><label class="lbl">Prezzo €</label><input id="a_pr" type="number" placeholder="145000"></div></div>
  <div class="two"><div style="flex:1"><label class="lbl">m²</label><input id="a_mq" type="number"></div><div style="flex:1"><label class="lbl">Locali</label><input id="a_loc" type="number" value="3"></div></div>
  <label class="lbl">Indirizzo</label><input id="a_ind">
  <button class="btn" style="margin-top:16px" onclick="addHouse()">Aggiungi</button></div>`;
  $("#sheet").classList.add("open");
}
async function addHouse(){
  const link=$("#a_link").value.trim();if(!link){toast("Serve almeno il link");return}
  const fonte=link.includes("idealista")?"Idealista":link.includes("immobiliare")?"Immobiliare.it":"Web";
  const pr=+$("#a_pr").value||null,mq=+$("#a_mq").value||null;
  const h={titolo:$("#a_tit").value||"Casa aggiunta a mano",comune:$("#a_com").value,prezzo:pr,mq,locali:+$("#a_loc").value||null,indirizzo:$("#a_ind").value,link,fonte,tipo:"Appartamento",stato:"Nuove",fav:false,note:[{chi:me,t:"Aggiunta a mano",q:now()}],voti:{},match:{sotto140:pr?pr<140000:null,mq80:mq?mq>=80:null},aggiunta:today()};
  const {error}=await sb.from(T).insert({data:h});
  if(error){toast("Non sono riuscita a salvarla");return}
  closeH();toast("Casa aggiunta");load();
}
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{view=b.dataset.v;render();scrollTo(0,0)});

(async()=>{let p=null;try{p=localStorage.getItem("casePin")}catch(e){}
 if(!(p&&await enter(p))){$("#lmsg").textContent="";$("#login").hidden=false}})();
