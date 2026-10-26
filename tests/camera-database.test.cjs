const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(fetch, env = {CAMERA_SUPABASE_URL:'https://example.supabase.co',CAMERA_SUPABASE_PUBLISHABLE_KEY:'public-test-value'}) {
  const exports = {};
  const authExports={};
  const sandbox={process:{env},fetch,URL,AbortSignal};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/camera-auth.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{...sandbox,exports:authExports,require});
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/camera-database.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {...sandbox,exports,require:(name)=> name==='./camera-auth' ? authExports : name==='./admin-auth' ? {adminSession:async()=>({accessToken:'signed-in-user-token',expiresAt:Date.now()+60000})} : require(name)});
  return exports;
}
test('database credentials must be complete',()=>{
  assert.throws(()=>load(null,{CAMERA_SUPABASE_URL:'https://example.supabase.co'}).databaseConfigured(),/incomplete/);
  assert.equal(load(null,{}).databaseConfigured(),false);
});
test('writes compare revision and preserve conflict signal',async()=>{
  const calls=[];
  const db=load(async(url,init)=>{calls.push({url,init}); return {ok:true,json:async()=>[]};});
  assert.equal(await db.writeCameraDatabase({version:1},7),false);
  assert.match(calls[0].url,/camera_studio_state\?id=eq.main&revision=eq.7$/);
  assert.equal(JSON.parse(calls[0].init.body).revision,8);
  assert.equal(calls[0].init.headers.Authorization,'Bearer signed-in-user-token');
  assert.equal(calls[0].init.cache,'no-store');
});
test('first writer uses conflict-safe insert',async()=>{
  const db=load(async(url,init)=>{
    assert.match(url,/on_conflict=id/);
    assert.match(init.headers.Prefer,/ignore-duplicates/);
    return {ok:true,json:async()=>[{id:'main'}]};
  });
  assert.equal(await db.writeCameraDatabase({version:1},null),true);
});
test('database errors are not treated as empty records',async()=>{
  const db=load(async()=>({ok:false,status:403}));
  await assert.rejects(db.readCameraDatabase(),/request failed/);
});
test('plain HTTP cannot receive the server key',async()=>{
  const db=load(()=>{throw Error('must not fetch');},{CAMERA_SUPABASE_URL:'http://example.com',CAMERA_SUPABASE_PUBLISHABLE_KEY:'public-test-value'});
  await assert.rejects(db.readCameraDatabase(),/requires HTTPS/);
});
