// Lecteur unique et annulable : le gameplay est déjà résolu avant play().
export function createTcgTimeline({onStep=()=>{},onComplete=()=>{},setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout,
  speed=1,reduced=false,clockDuration=null}={}) {
  let queue=[],index=0,timer=null,active=false,version=0,rate=speed,reduce=reduced;
  function clear() {if(timer!==null){clearTimeoutFn(timer);timer=null;}}
  function complete(skipped) {
    if(!active)return;
    clear();active=false;const events=queue;queue=[];
    onComplete({skipped,events});
  }
  function step() {
    if(!active)return;
    if(index>=queue.length){complete(false);return;}
    const event=queue[index++];
    onStep(event,index-1);
    if(!active)return;
    const duration=clockDuration ? clockDuration(event,{speed:rate,reduced:reduce}) : (reduce?50:Math.max(50,Math.round((event.duration||220)/rate)));
    timer=setTimeoutFn(()=>{timer=null;step();},duration);
  }
  return {
    play(events){
      this.cancel();
      queue=Array.isArray(events)?events.slice():[];
      index=0;active=true;version++;
      if(!queue.length){complete(false);return;}
      step();
    },
    skip(){complete(true);},
    cancel(){clear();active=false;queue=[];index=0;version++;},
    setSpeed(next){rate=next===2?2:1;},
    setReduced(next){reduce=Boolean(next);},
    get active(){return active;},
    get progress(){return {index,total:queue.length};},
    get token(){return version;},
  };
}
