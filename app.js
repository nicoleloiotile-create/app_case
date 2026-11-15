/* Le nostre case — dati su Supabase (tabella case_annunci), accesso con PIN */
const T="case_annunci";
const STATI=["Preferita","Contattata","Visita fissata","Visitata","Scartata"];
const TABS=["Tutte",...STATI];
const EVID=[["box","Box auto"],["balcone","Balcone"],["giardino","Giardino"],["sud","Esposizione sud"],["bagni2","2 bagni"],["noCond","Senza condominio"],["classe","Classe A–C"],["pronta","Pronta da abitare"],["cantina","Cantina"],["arredata","Arredata"]];
const CRIT=[["prezzo","Prezzo"],["zona","Zona e servizi"],["luce","Luce ed esposizione"],["stato","Stato e finiture"],["spazi","Spazi interni"],["esterni","Box ed esterni"],["consumi","Consumi e spese"],["quiete","Tranquillità"]];
const PERS=["Nicole","Simone"];
let sb=null,houses=[],pesi={};
let view="case",tab="Tutte",openId=null,editMode=false,calM=null,calSel=null;
let me="Nicole";try{me=localStorage.getItem("chi")||"Nicole"}catch(e){}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=n=>n?Number(n).toLocaleString("it-IT")+" €":"—";
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const nowS=()=>new Date().toLocaleString("it-IT",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
const fmtD=d=>d?new Date(d+"T12:00").toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"}):"";
const uid=()=>Math.random().toString(36).slice(2,9);
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("on");clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove("on"),2000)}
function H(id){return houses.find(h=>h.id==id)}

/* ---------- Accesso e dati ---------- */
async function enter(pin){
  sb=supabase.createClient(CASE_CONFIG.url,CASE_CONFIG.key,{auth:{persistSession:false},global:{headers:{"x-pin":pin}}});
  const {data,error}=await sb.from(T).select("id").limit(1);
  if(error||!data){$("#lmsg").textContent="PIN non corretto";return false}
  if(!data.length){ /* tabella vuota: verifico il PIN con una scrittura innocua */
    const r=await sb.from(T).upsert({id:"_pesi",data:{}}).select();if(r.error||!r.data||!r.data.length){$("#lmsg").textContent="PIN non corretto";return false}}
  try{localStorage.setItem("casePin",pin)}catch(e){}
  $("#login").hidden=true;$("#shell").hidden=false;
  await load();setInterval(()=>{if(!document.hidden)load()},15000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
  return true;
}
function tryPin(){const p=$("#pin").value.trim();if(p)enter(p)}
async function load(){
  const {data,error}=await sb.from(T).select("id,data");
  if(error){$("#sub").textContent="Errore nel caricamento dei dati";return}
  houses=data.filter(r=>!r.id.startsWith("_")).map(r=>({id:r.id,...r.data}));
  pesi=(data.find(r=>r.id=="_pesi")||{}).data||{};
  const typing=document.activeElement&&document.activeElement.matches("input,textarea,select");
  if(typing)return;
  render();if(openId&&!editMode&&H(openId))openH(openId,true);
}
const strip=h=>{const {id,...d}=h;return d};
async function save(id,patch){
  const h=H(id);if(!h)return;Object.assign(h,patch);rerender();
  const {error}=await sb.from(T).update({data:strip(h),updated_at:new Date().toISOString()}).eq("id",id);
  if(error)toast("Non salvato, riprova");
}
function rerender(){render();if(openId&&!editMode)openH(openId,true)}

/* punteggio 0–100 per persona, pesato */
function peso(p,k){const w=(pesi[p]||{})[k];return w==null?2:w}
function punti(h,p){const v=((h.valutazioni||{})[p])||{};let s=0,m=0;CRIT.forEach(([k])=>{const r=v[k],w=peso(p,k);if(r&&w){s+=r*w;m+=5*w}});return m?Math.round(s/m*100):null}
function media(h){const a=PERS.map(p=>punti(h,p)).filter(x=>x!=null);return a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null}

function switchMe(){me=me=="Nicole"?"Simone":"Nicole";try{localStorage.setItem("chi",me)}catch(e){}$("#me").textContent="Sono "+me+" ⇄";rerender();toast("Ora scrivi come "+me)}
$("#me").onclick=switchMe;$("#me").textContent="Sono "+me+" ⇄";
$("#fab").onclick=()=>openEdit(null);
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{view=b.dataset.v;render();scrollTo(0,0)});

/* ---------- Lista case ---------- */
const isSud=h=>/sud/i.test(h.esposizione||"")||(h.evid||{}).sud;
const classeL=h=>{const m=String(h.classe||"").match(/^\s*([A-G]\d?)\b/);return m?m[1]:(h.classe?"?":"–")};
function evidChips(h){const e=h.evid||{};return EVID.filter(([k])=>e[k]).map(([,l])=>`<span class="chip">${l}</span>`).join("")}
function card(h){
  const m=media(h),v=h.visita;
  const vis=v&&v.data?`<span class="chip o">${h.stato=="Visitata"?"Vista":"Visita"} ${fmtD(v.data)}${v.ora&&h.stato!="Visitata"?" · "+esc(v.ora):""}</span>`:"";
  const con=h.contattoData&&!(v&&v.data)?`<span class="chip o">Contattata ${fmtD(h.contattoData)}</span>`:"";
  const pc=`${(h.pro||[]).length?`<span class="chip d">+${h.pro.length} pro</span>`:""}${(h.contro||[]).length?`<span class="chip d">−${h.contro.length} contro</span>`:""}`;
  const f=(h.foto||[])[0];
  return `<button type="button" class="card" onclick="openH('${h.id}')">
   ${f?`<img class="cimg" src="${esc(f.url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<div class="cph">Nessuna foto</div>`}
   <div class="cbody"><div class="ctop"><div><div class="com">${esc(h.comune||"Senza comune")}</div><div class="mut">${esc(h.titolo||"")}</div></div>
   <div style="text-align:right"><div class="price">${eur(h.prezzo)}</div>${m!=null?`<span class="score" title="Punteggio medio">${m}</span>`:""}</div></div>
   <div class="keys"><div class="${isSud(h)?"hl":""}"><b>${esc(h.esposizione||"–")}</b><span>esposizione</span></div><div><b>${esc(classeL(h))}</b><span>classe</span></div><div><b>${h.mq||"–"}</b><span>m²</span></div><div><b>${(h.evid||{}).box?"Sì":"–"}</b><span>box</span></div></div>
   <div class="mut">${esc(h.stato)}${h.locali?" · "+h.locali+" locali":""}${h.bagni?" · "+h.bagni+" bagni":""}${h.piano?" · piano "+esc(h.piano):""}</div>
   <div class="chips">${evidChips(h)}${vis}${con}${pc}</div></div></button>`}

function render(){
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.v==view));
  const t=$("#tabs"),m=$("#main");$("#fab").hidden=view!="case";
  if(view=="case"){
    t.hidden=false;$("#ttl").textContent="Le nostre case";
    $("#sub").textContent=houses.length?`${houses.filter(h=>h.stato!="Scartata").length} case in lista`:"Segnate qui le case che vi interessano";
    t.innerHTML=TABS.map(s=>{const n=s=="Tutte"?houses.filter(h=>h.stato!="Scartata").length:houses.filter(h=>h.stato==s).length;return `<button type="button" class="tab ${s==tab?"on":""}" onclick="tab='${s}';render()">${s}${n?`<i>${n}</i>`:""}</button>`}).join("");
    const l=houses.filter(h=>tab=="Tutte"?h.stato!="Scartata":h.stato==tab).sort((a,b)=>(media(b)??-1)-(media(a)??-1)||String(b.aggiunta||"").localeCompare(String(a.aggiunta||"")));
    m.innerHTML=l.length?`<div class="list">${l.map(card).join("")}</div>`:(houses.length?`<div class="empty">Nessuna casa in “${tab}”.</div>`:`<div class="empty"><b>Ancora nessuna casa</b>Tocca + per segnare la prima: link, prezzo e caratteristiche dell'annuncio. Poi aggiungete pro, contro, domande e voti.</div>`);
  }else if(view=="cal"){t.hidden=true;renderCal(m)}
  else{t.hidden=true;renderConf(m)}
}

/* ---------- Calendario visite ---------- */
function renderCal(m){
  $("#ttl").textContent="Visite";
  const ev=houses.filter(h=>h.visita&&h.visita.data);
  const base=calM||new Date(),y=base.getFullYear(),mo=base.getMonth();
  const up=ev.filter(h=>h.visita.data>=today()&&h.stato!="Scartata").sort((a,b)=>(a.visita.data+(a.visita.ora||"")).localeCompare(b.visita.data+(b.visita.ora||"")));
  $("#sub").textContent=up.length?`${up.length} ${up.length==1?"visita in programma":"visite in programma"}`:"Nessuna visita in programma";
  const byDay={};ev.forEach(h=>{(byDay[h.visita.data]=byDay[h.visita.data]||[]).push(h)});
  let g=["L","M","M","G","V","S","D"].map(d=>`<div class="dn">${d}</div>`).join("");
  const first=(new Date(y,mo,1).getDay()+6)%7,len=new Date(y,mo+1,0).getDate();
  for(let i=0;i<first;i++)g+="<div></div>";
  for(let d=1;d<=len;d++){const k=y+"-"+String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");const has=byDay[k];
    g+=`<button type="button" class="d ${has?(k<today()?"past":"has"):""} ${k==today()?"today":""} ${k==calSel?"sel":""}" ${has?`onclick="calSel='${k}';render()"`:"disabled"} aria-label="${d}">${d}</button>`}
  const evRow=h=>{const d=new Date(h.visita.data+"T12:00");return `<button type="button" class="ev" onclick="openH('${h.id}')"><div class="dt"><small>${d.toLocaleDateString("it-IT",{weekday:"short"})}</small><b>${d.getDate()}</b><small>${d.toLocaleDateString("it-IT",{month:"short"})}</small></div><div><b>${esc(h.visita.ora||"")}${h.visita.ora?" · ":""}${esc(h.comune)}</b><div class="mut">${esc(h.indirizzo||h.titolo||"")} · ${eur(h.prezzo)}</div>${h.agenzia?`<div class="mut">${esc(h.agenzia)}${h.telefono?" · "+esc(h.telefono):""}</div>`:""}</div></button>`};
  const sel=calSel&&byDay[calSel]?`<div class="cap">${fmtD(calSel)}</div>${byDay[calSel].map(evRow).join("")}`:"";
  const past=ev.filter(h=>h.visita.data<today()).sort((a,b)=>b.visita.data.localeCompare(a.visita.data)).slice(0,10);
  m.innerHTML=`<div class="mhead"><button type="button" class="icon" onclick="calMove(-1)" aria-label="Mese precedente">‹</button><b style="text-transform:capitalize">${base.toLocaleDateString("it-IT",{month:"long",year:"numeric"})}</b><button type="button" class="icon" onclick="calMove(1)" aria-label="Mese successivo">›</button></div>
  <div class="mgrid">${g}</div>${sel}
  <div class="cap">Prossime visite</div>${up.map(evRow).join("")||`<div class="empty" style="padding:24px">Per fissarne una apri una casa e scegli giorno e ora nella sezione “Visita”.</div>`}
  ${past.length?`<div class="cap">Già viste</div>${past.map(evRow).join("")}`:""}`;
}
function calMove(n){const b=calM||new Date();calM=new Date(b.getFullYear(),b.getMonth()+n,1);calSel=null;render()}

/* ---------- Confronto ---------- */
function renderConf(m){
  $("#ttl").textContent="Confronto";
  const l=houses.filter(h=>h.stato!="Scartata").map(h=>({h,n:punti(h,"Nicole"),s:punti(h,"Simone"),m:media(h)})).sort((a,b)=>(b.m??-1)-(a.m??-1));
  const rated=l.filter(x=>x.m!=null);
  $("#sub").textContent=rated.length?`${rated.length} case valutate su ${l.length}`:"Valutate le case per vedere la classifica";
  const best=rated[0];
  const side=`<div class="tw"><table><thead><tr><th>Casa</th><th>Prezzo</th><th>Esp.</th><th>Classe</th><th>m²</th></tr></thead><tbody>${l.map(({h})=>`<tr style="cursor:pointer" onclick="openH('${h.id}')"><td>${esc(h.comune)}</td><td>${eur(h.prezzo)}</td><td>${esc(h.esposizione||"–")}</td><td>${esc(classeL(h))}</td><td>${h.mq||"–"}</td></tr>`).join("")}</tbody></table></div>`;
  const w=PERS.map(p=>`<div class="par"><b>Quanto conta per ${p}</b><div class="mut">0 = non importa · 3 = fondamentale</div>${CRIT.map(([k,lab])=>`<div class="wrow"><span>${lab}</span><div class="dots">${[0,1,2,3].map(i=>`<button type="button" class="${peso(p,k)==i?"on":""}" ${p==me?`onclick="setPeso('${p}','${k}',${i})"`:"disabled"} aria-label="${lab} peso ${i}">${i}</button>`).join("")}</div></div>`).join("")}${p!=me?`<div class="mut">Per modificare passa a “Sono ${p}” in alto.</div>`:""}</div>`).join("");
  m.innerHTML=`${best?`<div class="sec" style="border-top:0"><h3>In testa</h3><div class="row" style="justify-content:space-between;cursor:pointer" onclick="openH('${best.h.id}')"><div><div class="com">${esc(best.h.comune)}</div><div class="mut">${esc(best.h.titolo||"")} · ${eur(best.h.prezzo)}</div></div><div class="big">${best.m}</div></div></div>`:""}
  <div class="sec" ${best?"":`style="border-top:0"`}><h3>Classifica <span>su 100</span></h3>
  ${l.length?`<div class="tw"><table><thead><tr><th>Casa</th><th>Nicole</th><th>Simone</th><th>Media</th></tr></thead><tbody>${l.map((x,i)=>`<tr class="${i==0&&x.m!=null?"top":""}" style="cursor:pointer" onclick="openH('${x.h.id}')"><td>${esc(x.h.comune)}<div class="mut" style="font-weight:400">${eur(x.h.prezzo)}</div>${x.m!=null?`<div class="bars"><i style="width:${x.m}%"></i></div>`:""}</td><td>${x.n??"–"}</td><td>${x.s??"–"}</td><td>${x.m??"–"}</td></tr>`).join("")}</tbody></table></div>`:`<div class="mut">Aggiungi delle case e date un voto da 1 a 5 a ogni criterio nella loro scheda.</div>`}
  <div class="mut">Il punteggio di ognuno pesa i voti dei criteri (1–5) secondo quanto conta ogni criterio per lui o per lei.</div></div>
  ${l.length?`<div class="sec"><h3>A colpo d'occhio</h3>${side}</div>`:""}
  <div class="sec"><h3>Le vostre priorità</h3>${w}</div>`;
}
async function setPeso(p,k,i){pesi={...pesi,[p]:{...(pesi[p]||{}),[k]:i}};render();const {error}=await sb.from(T).upsert({id:"_pesi",data:pesi});if(error)toast("Non salvato")}

/* ---------- Scheda casa ---------- */
function listBox(h,kind,ph){const a=h[kind]||[];return `${a.map(x=>`<div class="item"><div class="t">${esc(x.t)}<br><small>${esc(x.chi)}</small></div><button type="button" class="x" onclick="delItem('${h.id}','${kind}','${x.id}')" aria-label="Elimina">×</button></div>`).join("")}
 <div class="row"><input id="in_${kind}" placeholder="${ph}" onkeydown="if(event.key=='Enter')addItem('${h.id}','${kind}')"><button type="button" class="btn o s" onclick="addItem('${h.id}','${kind}')">+</button></div>`}
function addItem(id,kind){const i=$("#in_"+kind),t=i.value.trim();if(!t)return;i.value="";const h=H(id);save(id,{[kind]:[...(h[kind]||[]),{id:uid(),t,chi:me,q:nowS()}]})}
function delItem(id,kind,iid){const h=H(id);save(id,{[kind]:(h[kind]||[]).filter(x=>x.id!=iid)})}
function toggleQ(id,qid){const h=H(id);save(id,{domande:(h.domande||[]).map(x=>x.id==qid?{...x,fatta:!x.fatta}:x)})}
function ansQ(id,qid,v){const h=H(id);save(id,{domande:(h.domande||[]).map(x=>x.id==qid?{...x,risposta:v}:x)})}
function setEvid(id,k){const h=H(id);save(id,{evid:{...(h.evid||{}),[k]:!(h.evid||{})[k]}})}
function rateC(id,k,n){const h=H(id),v=h.valutazioni||{},mv=v[me]||{};save(id,{valutazioni:{...v,[me]:{...mv,[k]:mv[k]==n?null:n}}})}
function setParere(id,f,val){const h=H(id),p=h.parere||{};save(id,{parere:{...p,[me]:{...(p[me]||{}),[f]:val}}})}
function setStato(id,s){const h=H(id),p={stato:s};if(s=="Contattata"&&!h.contattoData)p.contattoData=today();if(s=="Visitata"&&!(h.visita&&h.visita.data))p.visita={data:today(),ora:""};save(id,p);toast(s=="Scartata"?"Spostata tra le scartate":"Stato: "+s)}
function setVisita(id){const d=$("#vd").value,o=$("#vo").value;if(!d){toast("Scegli il giorno");return}const h=H(id);save(id,{visita:{data:d,ora:o},stato:d<today()?"Visitata":(h.stato=="Visitata"?"Visitata":"Visita fissata")});toast("Visita nel calendario")}
function setContatto(id){save(id,{contattoData:$("#cd").value||null,contattoCanale:$("#cc").value})}

function openH(id,keep){
  const h=H(id);if(!h)return;openId=id;editMode=false;
  const y=keep?$("#sheet").scrollTop:0;
  const v=h.visita||{},val=((h.valutazioni||{})[me])||{},par=h.parere||{};
  const pN=punti(h,"Nicole"),pS=punti(h,"Simone"),mm=media(h);
  $("#det").innerHTML=`<div class="bar"><button type="button" class="icon" onclick="closeS()" aria-label="Indietro">←</button><button type="button" class="btn o s" onclick="openEdit('${h.id}')">Modifica dati</button></div>
  ${(h.foto||[]).length?`<div class="gal">${h.foto.map(x=>`<figure><img src="${esc(x.url)}" alt="" referrerpolicy="no-referrer"><button type="button" class="x" onclick="delFoto('${h.id}','${x.id}')" aria-label="Togli foto">×</button></figure>`).join("")}</div>`:""}
  <label class="up" for="fu">＋ Aggiungi foto<input type="file" id="fu" accept="image/*" multiple hidden onchange="upFoto('${h.id}',this)"></label><div class="mut" style="margin:6px 0 12px">Salva le foto dall'annuncio (o fai uno screenshot) e caricale qui.</div>
  <div style="display:flex;flex-direction:column;gap:4px;padding-bottom:16px">
   <div class="mut">${esc(h.fonte||"")}${h.agenzia?" · "+esc(h.agenzia):""}</div>
   <h2>${esc(h.comune||"")}</h2><div class="mut">${esc(h.indirizzo||"")}</div>
   <div class="row" style="justify-content:space-between;margin-top:6px"><div class="big">${eur(h.prezzo)}</div>${mm!=null?`<span class="score">${mm}/100</span>`:""}</div>
   <div class="keys" style="margin-top:6px"><div class="${isSud(h)?"hl":""}"><b>${esc(h.esposizione||"–")}</b><span>esposizione</span></div><div><b>${esc(classeL(h))}</b><span>classe</span></div><div><b>${h.mq||"–"}</b><span>m²</span></div><div><b>${h.prezzo&&h.mq?Math.round(h.prezzo/h.mq).toLocaleString("it-IT"):"–"}</b><span>€/m²</span></div></div>
   ${h.titolo?`<div style="font-weight:600;margin-top:6px">${esc(h.titolo)}</div>`:""}
   ${h.descr?`<p style="margin:6px 0 0;color:var(--mut);font-size:14px">${esc(h.descr)}</p>`:""}
   ${h.link?`<a class="btn" style="margin-top:10px" href="${esc(h.link)}" target="_blank" rel="noopener">Apri l'annuncio ↗</a>`:""}
   ${h.telefono?`<a class="mut" style="text-align:center;display:block" href="tel:${esc(String(h.telefono).replace(/\s/g,""))}">Tel. ${esc(h.telefono)}</a>`:""}
  </div>
  <div class="sec"><h3>Caratteristiche</h3><div class="grid">
   <div><span>Tipologia</span>${esc(h.tipo||"—")}</div><div><span>Superficie</span>${h.mq?h.mq+" m²":"—"}</div>
   <div><span>Locali · camere</span>${h.locali||"—"} · ${h.camere||"—"}</div><div><span>Bagni</span>${h.bagni||"—"}</div>
   <div><span>Piano</span>${esc(h.piano||"—")}</div><div><span>Esposizione</span>${esc(h.esposizione||"—")}</div>
   <div><span>Box / garage</span>${(h.evid||{}).box?"Sì":"—"}</div><div><span>Classe energetica</span>${esc(h.classe||"—")}</div>
   <div><span>Spese condominiali</span>${esc(h.spese||"—")}</div><div><span>Anno</span>${esc(h.anno||"—")}</div></div></div>
  <div class="sec"><h3>In evidenza</h3><div class="pills">${EVID.map(([k,l])=>`<button type="button" class="pill ${(h.evid||{})[k]?"on":""}" onclick="setEvid('${h.id}','${k}')">${l}</button>`).join("")}</div></div>
  <div class="sec"><h3>Stato</h3><div class="pills">${STATI.map(s=>`<button type="button" class="pill ${s==h.stato?"on":""}" onclick="setStato('${h.id}','${s}')">${s}</button>`).join("")}</div>
   <div class="f2"><div><label class="l" for="cd">Contattata il</label><input type="date" id="cd" value="${esc(h.contattoData||"")}" onchange="setContatto('${h.id}')"></div>
   <div><label class="l" for="cc">Come</label><select id="cc" onchange="setContatto('${h.id}')">${["","Portale","Telefono","WhatsApp","Email","Di persona"].map(c=>`<option ${c==(h.contattoCanale||"")?"selected":""}>${c}</option>`).join("")}</select></div></div></div>
  <div class="sec"><h3>Visita</h3>
   ${v.data?`<div style="font-weight:600">${h.stato=="Visitata"||v.data<today()?"Vista":"Fissata"} ${fmtD(v.data)}${v.ora?" alle "+esc(v.ora):""}</div>`:""}
   <div class="f2"><input type="date" id="vd" aria-label="Giorno visita" value="${esc(v.data||"")}"><input type="time" id="vo" aria-label="Ora visita" value="${esc(v.ora||"")}"></div>
   <div class="row"><button type="button" class="btn o" onclick="setVisita('${h.id}')">${v.data?"Aggiorna visita":"Fissa visita"}</button>${v.data?`<button type="button" class="btn o s" onclick="save('${h.id}',{visita:null})">Togli</button>`:""}</div></div>
  <div class="sec"><h3>Pro e contro</h3><div class="pc"><div><h4>Pro</h4>${listBox(h,"pro","Aggiungi un pro")}</div><div><h4>Contro</h4>${listBox(h,"contro","Aggiungi un contro")}</div></div></div>
  <div class="sec"><h3>Domande da fare <span>${(h.domande||[]).filter(x=>x.fatta).length}/${(h.domande||[]).length}</span></h3>
   ${(h.domande||[]).map(x=>`<div class="item"><button type="button" class="chk ${x.fatta?"on":""}" onclick="toggleQ('${h.id}','${x.id}')" aria-label="Fatta">${x.fatta?"✓":""}</button><div class="t" style="display:flex;flex-direction:column;gap:6px"><span style="${x.fatta?"text-decoration:line-through;color:var(--mut)":""}">${esc(x.t)}</span><input placeholder="Risposta…" value="${esc(x.risposta||"")}" onchange="ansQ('${h.id}','${x.id}',this.value)"></div><button type="button" class="x" onclick="delItem('${h.id}','domande','${x.id}')" aria-label="Elimina">×</button></div>`).join("")}
   <div class="row"><input id="in_domande" placeholder="Es. spese di riscaldamento annue?" onkeydown="if(event.key=='Enter')addItem('${h.id}','domande')"><button type="button" class="btn o s" onclick="addItem('${h.id}','domande')">+</button></div></div>
  <div class="sec"><h3>Appunti</h3>${(h.appunti||[]).map(x=>`<div class="item"><div class="t">${esc(x.t)}<br><small>${esc(x.chi)} · ${esc(x.q)}</small></div><button type="button" class="x" onclick="delItem('${h.id}','appunti','${x.id}')" aria-label="Elimina">×</button></div>`).join("")}
   <textarea id="in_appunti" placeholder="Scrivi un appunto come ${me}…"></textarea><button type="button" class="btn o" onclick="addItem('${h.id}','appunti')">Aggiungi appunto</button></div>
  <div class="sec"><h3>Voti di ${me} <span>${punti(h,me)??"–"}/100</span></h3><div class="mut">Da 1 (male) a 5 (benissimo). Tocca di nuovo per togliere.</div>
   ${CRIT.map(([k,l])=>`<div class="rate"><span>${l}</span><div class="dots">${[1,2,3,4,5].map(i=>`<button type="button" class="${val[k]==i?"on":""}" onclick="rateC('${h.id}','${k}',${i})" aria-label="${l} ${i}">${i}</button>`).join("")}</div></div>`).join("")}
   <div class="mut">Nicole ${pN??"–"} · Simone ${pS??"–"} · media ${mm??"–"}</div></div>
  <div class="sec"><h3>Parere generale</h3><div class="pc">${PERS.map(p=>{const q=par[p]||{};return `<div class="par"><b>${p}</b>${p==me?`<textarea placeholder="Cosa ne pensi, in due righe" onchange="setParere('${h.id}','testo',this.value)">${esc(q.testo||"")}</textarea>`:`<div style="font-size:14px;${q.testo?"":"color:var(--mut)"}">${esc(q.testo||"Non ancora scritto")}</div>`}</div>`}).join("")}</div></div>
  <div class="sec"><button type="button" class="btn o" onclick="askDel('${h.id}')" id="delb">Elimina casa</button></div>`;
  $("#sheet").hidden=false;$("#sheet").scrollTop=y;
}
function askDel(id){const b=$("#delb");if(b.dataset.ok){delH(id);return}b.dataset.ok=1;b.textContent="Tocca di nuovo per eliminare definitivamente"}
async function delH(id){closeS();houses=houses.filter(h=>h.id!=id);render();const {error}=await sb.from(T).delete().eq("id",id);toast(error?"Non eliminata":"Casa eliminata")}
/* foto: ridimensionate nel telefono e salvate insieme alla casa */
function shrink(file){return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,1200/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext("2d").drawImage(im,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",.72))};im.onerror=rej;im.src=fr.result};fr.onerror=rej;fr.readAsDataURL(file)})}
async function upFoto(id,inp){const fs=[...inp.files];if(!fs.length)return;toast("Carico "+fs.length+" foto…");const add=[];
  for(const f of fs){try{add.push({id:uid(),url:await shrink(f)})}catch(e){toast("Una foto non è stata caricata")}}
  if(add.length){const h=H(id);await save(id,{foto:[...(h.foto||[]),...add]});toast("Foto aggiunte")}}
function delFoto(id,fid){const h=H(id);save(id,{foto:(h.foto||[]).filter(x=>x.id!=fid)})}
function closeS(){openId=null;editMode=false;$("#sheet").hidden=true;render()}

/* ---------- Aggiungi / modifica ---------- */
const FIELDS=[["link","Link annuncio","url"],["comune","Comune",""],["indirizzo","Indirizzo / zona",""],["titolo","Titolo breve",""],["prezzo","Prezzo €","number"],["mq","Superficie m²","number"],["locali","Locali","number"],["camere","Camere","number"],["bagni","Bagni","number"],["piano","Piano",""],["esposizione","Esposizione",""],["tipo","Tipologia",""],["classe","Classe energetica",""],["spese","Spese condominiali",""],["anno","Anno costruzione",""],["agenzia","Agenzia / privato",""],["telefono","Telefono",""]];
function openEdit(id){
  const h=id?H(id):{};openId=id;editMode=true;
  $("#det").innerHTML=`<div class="bar"><button type="button" class="icon" onclick="${id?`openH('${id}')`:"closeS()"}" aria-label="Indietro">←</button></div>
  <h2>${id?"Modifica dati":"Nuova casa"}</h2><p class="mut">Copia le caratteristiche principali dall'annuncio. Puoi completarle dopo.</p>
  <form id="ef" style="display:flex;flex-direction:column;gap:12px">
  <div class="f2">${FIELDS.map(([k,l,t])=>`<div style="${["link","indirizzo","titolo"].includes(k)?"grid-column:1/-1":""}"><label class="l" for="f_${k}">${l}</label><input id="f_${k}" ${t?`type="${t}"`:""} ${t=="number"?'inputmode="numeric"':""} value="${esc(h[k]??(k=="tipo"&&!id?"Appartamento":""))}"></div>`).join("")}</div>
  <div><label class="l" for="f_descr">Descrizione</label><textarea id="f_descr" placeholder="Le cose principali dell'annuncio">${esc(h.descr||"")}</textarea></div>
  <button class="btn" type="submit">${id?"Salva":"Aggiungi casa"}</button></form>`;
  $("#sheet").hidden=false;$("#sheet").scrollTop=0;
  $("#ef").onsubmit=async e=>{e.preventDefault();
    const d={};FIELDS.forEach(([k,,t])=>{const v=$("#f_"+k).value.trim();d[k]=t=="number"?(v?+v:null):v});d.descr=$("#f_descr").value.trim();
    if(!d.comune&&!d.link){toast("Scrivi almeno il comune o il link");return}
    if(d.link)d.fonte=d.link.includes("idealista")?"Idealista":d.link.includes("immobiliare")?"Immobiliare.it":d.link.includes("casa.it")?"Casa.it":"Web";
    if(id){Object.assign(H(id),d);await save(id,d);openH(id);return}
    const nid="c-"+Date.now().toString(36)+uid();
    const n={...d,stato:"Preferita",evid:{},pro:[],contro:[],domande:[],appunti:[],valutazioni:{},parere:{},foto:[],aggiunta:today(),daChi:me};
    const {error}=await sb.from(T).insert({id:nid,data:n});
    if(error){toast("Non salvata, riprova");return}
    houses.push({id:nid,...n});toast("Casa aggiunta");openH(nid);
  };
}

/* ---------- Avvio ---------- */
(async()=>{let p=null;try{p=localStorage.getItem("casePin")}catch(e){}
 if(!(p&&await enter(p))){$("#lmsg").textContent="";$("#login").hidden=false}})();
