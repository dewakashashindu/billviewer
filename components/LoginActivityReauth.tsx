'use client';
import {useState} from 'react';

export default function LoginActivityReauth(){
 const [password,setPassword]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  try{
   const res=await fetch('/api/login-activity/reauth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
   const data=await res.json().catch(()=>null);
   if(!res.ok){setError(String(data?.error??'Incorrect password.'));setBusy(false);return}
   window.location.reload();
  }catch{setError('Unable to verify right now. Please try again.');setBusy(false)}
 };
 return <form onSubmit={submit} style={{maxWidth:380,margin:'40px auto',border:'1px solid #e5ddd2',borderRadius:14,padding:22,background:'#fffdf9'}}>
  <div style={{fontSize:26,textAlign:'center'}} aria-hidden="true">🔒</div>
  <h1 style={{fontSize:19,textAlign:'center',margin:'8px 0 4px'}}>Confirm it is you</h1>
  <p style={{fontSize:13,color:'#6b5d4f',textAlign:'center',margin:'0 0 16px',lineHeight:1.5}}>Login Activity is restricted. Enter your account password again to view it. Access lasts 10 minutes.</p>
  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" autoFocus autoComplete="current-password"
   style={{width:'100%',boxSizing:'border-box',padding:'11px 12px',borderRadius:9,border:'1px solid #d8cbb8',marginBottom:10}}/>
  {error&&<p style={{color:'#8a2f23',fontSize:13,margin:'0 0 10px'}}>{error}</p>}
  <button type="submit" disabled={busy||!password} style={{width:'100%',padding:'11px',borderRadius:9,border:0,background:'#b46a28',color:'#fff',fontWeight:700,cursor:'pointer',opacity:busy||!password?.55:1}}>{busy?'Checking…':'Continue'}</button>
 </form>;
}
