'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
export default function AccessGuard(){const path=usePathname();useEffect(()=>{if(path==='/login'||path.startsWith('/admin'))return;let alive=true;async function check(){try{const response=await fetch('/api/customer/access',{cache:'no-store'});if(alive&&response.status===403){document.querySelectorAll('video').forEach(video=>{const stream=video.srcObject;if(stream instanceof MediaStream)stream.getTracks().forEach(track=>track.stop());});location.replace('/login');}}catch{}}void check();const timer=setInterval(check,30000);window.addEventListener('focus',check);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',check);};},[path]);return null;}
