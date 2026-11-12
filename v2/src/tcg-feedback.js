// Sons synthétiques originaux, créés à la demande. Aucun fichier externe.
// Débloquer AudioContext après interaction utilisateur ; iOS peut refuser silencieusement.
import { TCG_MOTION } from './tcg-motion-config.js';
export function createTcgFeedback(win = typeof window !== 'undefined' ? window : null) {
  let ctx=null,muted=true,volume=TCG_MOTION.defaultVolume,vibrate=false;
  const play=(name)=>{
    if(muted || !win)return;
    try {
      const AudioCtor=win.AudioContext||win.webkitAudioContext;
      if(!AudioCtor)return;
      ctx ||= new AudioCtor();
      if(ctx.state==='suspended')void ctx.resume().catch(()=>{});
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      const now=ctx.currentTime,frequency=TCG_MOTION.soundNotes[name]||400;
      osc.type=name==='impact'||name==='ko'?'triangle':'sine';
      osc.frequency.setValueAtTime(frequency,now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(50,frequency*0.72),now+0.12);
      gain.gain.setValueAtTime(0.0001,now);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume*.2),now+0.012);
      gain.gain.exponentialRampToValueAtTime(.0001,now+0.16);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(now);osc.stop(now+0.17);
      osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }catch{}
  };
  return {
    play,
    pulse(){if(!vibrate)return;try {win?.navigator?.vibrate?.(20);}catch{}},
    setMuted(v){muted=Boolean(v);},
    setVolume(v){volume=Math.max(0,Math.min(1,Number(v)||0));},
    setVibration(v){vibrate=Boolean(v);},
    dispose(){if(ctx){void ctx.close().catch(()=>{});ctx=null;}},
    get muted(){return muted;},get volume(){return volume;},get vibration(){return vibrate;},
  };
}
