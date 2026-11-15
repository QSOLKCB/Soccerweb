// Browser-only comparison harness. Reconstructs ordinary inputs, never injects match state.
export async function capture({baseline=false,stage=0,pixel=false,wide=false,minimal=false}){
 const root=new URL(baseline?'../work/standards-base/':'../',import.meta.url);
 const {createState,EMPTY}=await import(new URL('game/state.mjs',root));
 const {step}=await import(new URL('game/match.mjs',root));
 const {Renderer}=await import(new URL('render/canvas.mjs',root));
 const {goalGeometry}=await import(new URL('modes/goalposts.mjs',root));
 const {stateHash,Recorder,verifyReplay}=await import(new URL('replay/replay.mjs',root));
 const {routeInput}=await import(new URL('tests/goalposts_route.mjs',root));
 const s=createState({mode:'goalposts',seed:731,difficulty:1,aftertouch:2}),recorder=new Recorder(s),recent=[];
 while((s.goalposts.stage<stage||s.goalposts.clock<180)&&s.tick<5000){
  const inputs=s.goalposts.stage<stage?routeInput(s):[{...EMPTY},{...EMPTY}];step(s,inputs);recorder.record(s,inputs);
  recent.push(structuredClone(s));if(recent.length>121)recent.shift();
 }
 if(s.goalposts.stage!==stage||s.goalposts.clock!==180||s.phase!=='play')throw Error('Real-input comparison route failed');
 const replay=recorder.export(s);if(stateHash(verifyReplay(replay))!==stateHash(s))throw Error('Replay differs');
 const renderer=new Renderer(document.querySelector('canvas'));renderer.pixelated=pixel;renderer.zoom=wide?'wide':'follow';renderer.effects=minimal?'minimal':'balanced';
 for(let i=1;i<recent.length;i++)renderer.draw(recent[i],recent[i-1],1);
 const geometry=goalGeometry(s,0),view=renderer.camera;
 const sign=baseline?null:(await import(new URL('render/stadium.mjs',root))).standardSign(geometry,view.scale);
 const bounds=sign?{left:(sign.left-view.x)*view.scale+innerWidth/2,right:(sign.right-view.x)*view.scale+innerWidth/2,top:(sign.top-view.y)*view.scale+innerHeight/2,bottom:(sign.bottom-view.y)*view.scale+innerHeight/2}:null;
 return {kind:'Canvas-only deterministic input replay; no app HUD',baseline,stage,tick:s.tick,clock:s.goalposts.clock,hash:stateHash(s),replayVersion:replay.version,config:s.config,score:s.score,camera:view,geometry,sign,bounds,players:s.players.map(p=>({id:p.id,x:p.x,y:p.y})),options:{pixel,wide,minimal,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
}
