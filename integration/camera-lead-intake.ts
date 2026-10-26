import {createClient} from 'npm:@supabase/supabase-js@2.99.1';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Access-Control-Allow-Origin':'https://savrdhtechnologies.com','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const origin=req.headers.get('origin');if(origin&&!['https://savrdhtechnologies.com','https://www.savrdhtechnologies.com','https://camera-control-studio.vercel.app'].includes(origin))return reply({error:'Origin not allowed'},403);
 try{
 const raw=await req.text();if(raw.length>5000)return reply({error:'Request too large'},413);const b=JSON.parse(raw);if(b.website)return reply({ok:true});
 const id=String(b.request_id||''),email=String(b.email||'').trim().toLowerCase(),name=String(b.customer_name||'').trim(),phone=String(b.phone||'').trim();
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)||name.length<2||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\+?[0-9()\s-]{8,18}$/.test(phone))return reply({error:'Invalid request'},400);
 const ref='camera-trial-'+id;
 const old=await db.from('st_crm_leads').select('id').eq('client_ref',ref).maybeSingle();if(old.error)throw old.error;if(old.data)return reply({ok:true,crm_recorded:true});
 const recent=await db.from('st_crm_leads').select('id').eq('email',email).eq('product_interest','SAVRDH Camera Control Studio').gte('created_at',new Date(Date.now()-600000).toISOString()).limit(1);if(recent.error)throw recent.error;if(recent.data?.length)return reply({ok:true,crm_recorded:true});
 const {error}=await db.from('st_crm_leads').insert({client_ref:ref,business_name:name,contact_name:name,category:'Software',mobile:phone,email,lead_source:'Website',priority:'Warm',status:'New',product_name:'SAVRDH Camera Control Studio',product_interest:'SAVRDH Camera Control Studio',package_name:'15-Day Trial',notes:'Camera Studio trial request. Access remains locked until Camera Studio Super Admin approval.',email_opt_in:false,auto_email:false,metadata:{source:'camera_trial_form',product_code:'savrdh-camera-control-studio',trial_request_id:id}});
 if(error&&error.code!=='23505')throw error;
 return reply({ok:true,crm_recorded:true});
 }catch{return reply({error:'CRM registration could not be completed'},503);}
});
