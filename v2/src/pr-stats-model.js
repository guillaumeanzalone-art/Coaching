// The PR history and observed training series are separate datasets.
export const LIFT_META = Object.freeze({
  sq: {key:'squat',label:'Squat',short:'SQ'},
  bn: {key:'bench',label:'Bench',short:'BN'},
  dl: {key:'deadlift',label:'Deadlift',short:'DL'},
})
export function validStatsRows(rows, observed=false) {
  const unique = new Map()
  for (const row of Array.isArray(rows) ? rows : []) {
    const code=String(row?.exercise_code||'').toLowerCase()
    const reps=Number(row?.reps)
    const kg=Number(row?.new_load_kg)
    const date=Date.parse(row?.achieved_at)
    if (!LIFT_META[code] || !Number.isInteger(reps) || reps<1 || reps>9 || !Number.isFinite(kg) || kg<=0 || !Number.isFinite(date)) continue
    const normalized={...row,exercise_code:code,reps,new_load_kg:kg,achieved_at:new Date(date).toISOString()}
    const key=observed ? [code,reps,normalized.achieved_at.slice(0,10)].join('|') : [code,reps,normalized.achieved_at,kg].join('|')
    const previous=unique.get(key)
    if (!previous || (observed && kg>previous.new_load_kg)) unique.set(key,normalized)
  }
  return [...unique.values()].sort((a,b)=>a.achieved_at.localeCompare(b.achieved_at))
}
export function statsForLift(rows,code,reps) {
  return rows.filter(row=>row.exercise_code===code && (reps==null || row.reps===Number(reps)))
}
export function observedE1rmRows(rows) {
  const daily=new Map()
  for(const row of validStatsRows(rows,true)) {
    const kg=row.reps===1?row.new_load_kg:row.new_load_kg*(1+row.reps/30)
    const key=row.exercise_code+'|'+row.achieved_at.slice(0,10)
    if(!daily.has(key)||kg>daily.get(key).new_load_kg)daily.set(key,{...row,new_load_kg:kg,source_load_kg:row.new_load_kg})
  }
  return [...daily.values()].sort((a,b)=>a.achieved_at.localeCompare(b.achieved_at))
}
export function chartGeometry(rows) {
  if (!rows.length) return null
  const numbers=rows.map(r=>r.new_load_kg)
  const min=Math.min(...numbers),max=Math.max(...numbers)
  const margin=Math.max(2.5,(max-min)*.12)
  const yMin=Math.max(0,Math.floor((min-margin)/2.5)*2.5)
  const yMax=Math.ceil((max+margin)/2.5)*2.5
  const start=Date.parse(rows[0].achieved_at),end=Date.parse(rows.at(-1).achieved_at)
  const x1=48,x2=406,y1=18,y2=144
  const points=rows.map((row,i)=>({
    row,x: x1+(start===end?.5:(Date.parse(row.achieved_at)-start)/(end-start))*(x2-x1),
    y:y2-(row.new_load_kg-yMin)/(yMax-yMin)*(y2-y1),index:i,
  }))
  return {points,yMin,yMax,x1,x2,y1,y2}
}
export function observedSummary(rows) {
  const unique=validStatsRows(rows,true)
  const sets=unique.reduce((sum,r)=>sum+(Math.max(0,Number(r.set_count)||0)),0)
  const tonnage=unique.reduce((sum,r)=>sum+(Math.max(0,Number(r.tonnage)||0)),0)
  return {sets,tonnage,days:new Set(unique.map(r=>r.achieved_at.slice(0,10))).size}
}
