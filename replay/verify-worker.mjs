import { verifyReplay } from './replay.mjs';
self.onmessage=({data})=>{try{const replay=JSON.parse(data);verifyReplay(replay);self.postMessage({replay});}catch(error){self.postMessage({error:error.message});}};
