const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(fetch){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/camera-auth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,fetch,URL,AbortSignal,process:{env:{CAMERA_SUPABASE_URL:'https://example.supabase.co',CAMERA_SUPABASE_PUBLISHABLE_KEY:'public-test'}}});return exports;}
test('valid Supabase user without Camera membership is denied',async()=>{
 let n=0;const auth=load(async()=>({ok:true,json:async()=>++n===1?{id:'tv-user'}:[]}));
 assert.equal(await auth.cameraUserIsAdmin('token'),null);
});
test('invalid Supabase token is denied before querying membership',async()=>{
 let calls=0;const auth=load(async()=>{calls++;return {ok:false};});
 assert.equal(await auth.cameraUserIsAdmin('token'),null);assert.equal(calls,1);
});
test('identity mismatch is denied',async()=>{
 const auth=load(async()=>({ok:true,json:async()=>({id:'someone-else'})}));
 assert.equal(await auth.cameraUserIsAdmin('token','camera-admin'),null);
});
test('valid Camera member is allowed',async()=>{
 let n=0;const auth=load(async(url,init)=>{assert.equal(init.headers.Authorization,'Bearer token');return {ok:true,json:async()=>++n===1?{id:'camera-admin'}:[{user_id:'camera-admin'}]};});
 assert.equal(await auth.cameraUserIsAdmin('token','camera-admin'),'camera-admin');
});
