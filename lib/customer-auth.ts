import {getIronSession} from 'iron-session';
import {cookies} from 'next/headers';
import {adminConfig} from './admin-auth';
export async function customerSession(){return getIronSession<{userId?:string;accessToken?:string;expiresAt?:number}>(await cookies(),{password:(await adminConfig()).sessionSecret,cookieName:'savrdh_customer',ttl:3600,cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/'}});}
