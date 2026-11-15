import { supabase } from './supabase.js'
import { LIFT_META, validStatsRows, statsForLift, observedE1rmRows, chartGeometry, observedSummary } from './pr-stats-model.js'
function esc(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')}
function kg(value){return Number(value).toLocaleString('fr-FR',{maximumFractionDigits:1})}
function date(value){const d=new Date(value);return value&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short',year:'2-digit',timeZone:'Europe/Paris'}).format(d):'—'}
function renderChart(rows,code,{reps=null,kind='observed',reference=null}={}){
 const m=LIFT_META[code],history=statsForLift(rows,code,reps)
 const mode=kind==='estimate'?'e1RM':kind==='official'?'PR enregistré':'Meilleure série du jour'
 const header='<div><span>'+m.short+'</span><strong>'+m.label+'</strong></div>'
 const ref=Number(reference?.load_kg)
 const referenceLabel=Number.isFinite(ref)&&ref>0?'<p class="pr-stats-reference">PR actuel : <b>'+esc(kg(ref))+' kg</b></p>':''
 if(!history.length)return '<article class="pr-stats-chart pr-stats-chart--'+m.key+'"><header>'+header+'<em>'+esc(mode)+'</em></header><div class="pr-stats-empty"><b>Aucun point daté'+(reps?' ×'+reps:'')+'</b><small>'+(kind==='official'?'Aucun record historique daté disponible.':'Aucune série réussie enregistrée pour ce filtre.')+'</small></div>'+referenceLabel+'</article>'
 const geometry=chartGeometry(history),last=history.at(-1),first=history[0]
 const previous=Number(first.previous_load_kg)
 const baseline=kind==='official'&&previous>0?previous:first.new_load_kg
 const hasGain=history.length>1||(kind==='official'&&previous>0)
 const gain=last.new_load_kg-baseline
 const line=geometry.points.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')
 const bottom=geometry.y2
 const firstPoint=geometry.points[0],lastPoint=geometry.points.at(-1)
 const area=history.length>1?'<polygon class="pr-stats-area" points="'+firstPoint.x+','+bottom+' '+line+' '+lastPoint.x+','+bottom+'"/>':''
 const grid=[0,.25,.5,.75,1].map(r=>{const y=geometry.y1+(geometry.y2-geometry.y1)*r;return '<line x1="'+geometry.x1+'" x2="'+geometry.x2+'" y1="'+y+'" y2="'+y+'"/><text x="3" y="'+(y+4)+'" class="pr-stats-axis-label">'+esc(kg(geometry.yMax-(geometry.yMax-geometry.yMin)*r))+' kg</text>'}).join('')
 // Label a dot on one observation; avoid a fabricated line/area.
 const dots=geometry.points.map(p=>'<g class="pr-stats-dot"><circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+(history.length===1||p.index===history.length-1?4.8:2.6)+'"/><title>'+esc(date(p.row.achieved_at)+' · '+kg(p.row.new_load_kg)+' kg'+(kind==='estimate'?' (estimé)':''))+'</title></g>').join('')
 return '<article class="pr-stats-chart pr-stats-chart--'+m.key+'"><header>'+header+'<div class="pr-stats-chart__current"><strong>'+esc(kg(last.new_load_kg))+' <small>kg</small></strong><em class="'+(hasGain&&gain>0?'positive':'')+'">'+(hasGain?(gain>0?'+':'')+esc(kg(gain))+' kg sur la période':'1 point daté')+'</em></div></header><p class="pr-stats-reference">'+esc(mode)+(reps?' ×'+reps:'')+'</p><div class="pr-stats-svg-wrap"><svg viewBox="0 0 440 166" role="img" aria-label="'+esc(m.label+' · '+mode+(reps?' ×'+reps:''))+'" class="pr-stats-svg" preserveAspectRatio="none"><g class="pr-stats-grid">'+grid+'</g>'+area+(history.length>1?'<polyline class="pr-stats-line" points="'+line+'"/>':'')+dots+'</svg></div><footer><span>'+esc(date(first.achieved_at))+'</span><b>'+history.length+' '+(kind==='official'?'PR daté'+(history.length>1?'s':''):'jour'+(history.length>1?'s':''))+'</b><span>'+esc(date(last.achieved_at))+'</span></footer>'+referenceLabel+'</article>'
}
export async function loadAthletePrHistory(athleteSlug){
 if(!athleteSlug)return []
 const rows=[],size=500
 for(let offset=0;;offset+=size){
  const {data,error}=await supabase.from('pr_history').select('id,athlete_slug,exercise_code,exercise_name,set_label,reps,new_load_kg,previous_load_kg,achieved_at,program_key,week_label,day_name,source_label').eq('athlete_slug',athleteSlug).in('exercise_code',['sq','bn','dl']).order('achieved_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+size-1)
  if(error)throw error
  rows.push(...(data||[]))
  if((data||[]).length<size)break
 }
 return validStatsRows(rows)
}
export async function loadAthleteObservedStats(athleteSlug){
 if(!athleteSlug)return []
 const {data,error}=await supabase.rpc('athlete_observed_sbd_stats_v1',{p_athlete_slug:athleteSlug})
 if(error)throw error
 if(!Array.isArray(data))throw new Error('Réponse statistique invalide')
 return validStatsRows(data,true)
}
function cards(rows,opts){return '<div class="pr-stats-charts">'+Object.keys(LIFT_META).map(code=>renderChart(rows,code,{...opts,reference:opts.references?.[LIFT_META[code].key]?.[opts.reps]})).join('')+'</div>'}
function section(title,description,content){
 return '<section class="pr-stats-section"><header><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></header>'+content+'</section>'
}
function summaryCard(label,value){return '<article><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></article>'}
export function renderPrStatsPanel({athleteName,rows,observedRows=[],references={},reps=1,loading=false,error='',observedError=''}){
 const n=Math.max(1,Math.min(9,Math.trunc(Number(reps)||1)))
 const historical=validStatsRows(rows),observed=validStatsRows(observedRows,true)
 const recent=historical.filter(r=>r.reps===n).slice().reverse().slice(0,8)
 const selected=observed.filter(r=>r.reps===n),summary=observedSummary(observed)
 const refresh='<button type="button" class="pr-stats-refresh" data-action="reload-pr-stats" '+(loading?'disabled':'')+'>'+(loading?'Actualisation…':'↻ Actualiser')+'</button>'
 const notice=(message)=>'<div class="pr-stats-error" role="status"><strong>'+esc(message)+'</strong>'+refresh+'</div>'
 const initial=loading&&!historical.length&&!observed.length
 const historyList=recent.length?'<div class="pr-stats-history__list">'+recent.map(row=>'<article><span class="lift">'+LIFT_META[row.exercise_code].short+'</span><div><strong>'+LIFT_META[row.exercise_code].label+' ×'+n+'</strong><small>'+esc(date(row.achieved_at))+' · '+esc(row.source_label||'Historique')+'</small></div><div class="load"><strong>'+esc(kg(row.new_load_kg))+' kg</strong></div></article>').join('')+'</div>':'<div class="pr-stats-history__empty">Aucun PR daté ×'+n+' dans l’historique.</div>'
 return '<section class="pr-stats-panel"><header class="pr-stats-hero"><div><span>STATISTIQUES · PROGRESSION</span><h2>'+esc(athleteName||'Athlète')+'</h2><p>Performances réellement validées, estimations et records conservés.</p></div>'+refresh+'</header>'+
 '<div class="pr-stats-reps" role="tablist" aria-label="Nombre de répétitions">'+Array.from({length:9},(_,i)=>i+1).map(r=>'<button type="button" role="tab" class="'+(r===n?'active':'')+'" aria-selected="'+(r===n)+'" data-action="select-sbd-reps" data-reps="'+r+'">×'+r+'</button>').join('')+'</div>'+
 (initial?'<div class="pr-stats-loading"><i></i><strong>Chargement des statistiques…</strong></div>':'')+
 (observedError?notice('Performances en séance : '+observedError):'')+
 (error?notice('Historique des PR : '+error):'')+
 '<div class="pr-stats-summary">'+summaryCard('Séries SBD ×1–9',summary.sets.toLocaleString('fr-FR'))+summaryCard('Tonnage SBD ×1–9',kg(summary.tonnage/1000)+' t')+summaryCard('Jours enregistrés',summary.days.toLocaleString('fr-FR'))+'</div>'+
 section('Meilleures performances ×'+n,'Meilleure charge réussie de chaque jour, pour ce nombre de répétitions. Ce ne sont pas des PR absolus.',cards(observed,{reps:n,kind:'observed',references}))+
 section('Force estimée • e1RM','Estimation Epley sur les séries réussies de 1 à 9 répétitions ; un single garde sa charge réelle. Indépendant du filtre de répétitions.',cards(observedE1rmRows(observed),{kind:'estimate'}))+
 section('Records historiques ×'+n,'Records datés et récupérés. Le PR actuel est indiqué séparément, y compris lorsqu’il provient d’un import sans date.',cards(historical,{reps:n,kind:'official',references}))+
 '<section class="pr-stats-history"><header><div><span>HISTORIQUE</span><strong>Derniers PR ×'+n+'</strong></div><small>'+recent.length+' affiché(s)</small></header>'+historyList+'</section></section>'
}
