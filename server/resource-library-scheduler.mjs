// Optional local monthly timer. Disabled catalogs create no timer or requests.
// Each due run delegates to the same bounded, rights-checked manual batch.
export function createResourceLibraryScheduler({library,now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  let timer=null,controller=null,closed=false,generation=0;
  const state={enabled:false,nextCheckAt:null,running:false,lastError:null,expectedIdleRequests:0};
  const interval=30*24*60*60*1000,maxDelay=24*24*60*60*1000;
  async function configure(){
    const epoch=++generation;if(timer!==null){clearTimer(timer);timer=null;}controller?.abort();controller=null;
    if(closed)return {...state};const {schedule}=await library.scheduleSettings();if(epoch!==generation||closed)return {...state};
    state.enabled=schedule.enabled===true;state.lastError=null;state.nextCheckAt=null;
    if(!state.enabled)return {...state};
    const previous=Date.parse(schedule.lastRunAt||schedule.enabledAt),due=Number.isFinite(previous)?previous+interval:now()+interval;
    state.nextCheckAt=new Date(due).toISOString();
    const arm=()=>{timer=setTimer(async()=>{timer=null;if(closed||epoch!==generation)return;if(now()<due){arm();return;}
      controller=new AbortController();state.running=true;
      try{await library.runSchedule({signal:controller.signal});}
      catch(error){state.lastError=String(error.message||'Scheduled verification failed.');state.nextCheckAt=null;}
      finally{state.running=false;controller=null;}
      // Errors stop this schedule until its settings are explicitly reviewed.
      if(!state.lastError&&!closed&&epoch===generation)await configure();
    },Math.min(maxDelay,Math.max(1,due-now())));timer?.unref?.();};arm();return {...state};
  }
  return {configure,describe:()=>({...state}),close(){closed=true;generation++;if(timer!==null)clearTimer(timer);timer=null;controller?.abort();controller=null;state.enabled=false;state.nextCheckAt=null;}};
}
