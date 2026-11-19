"use client";
import {useCallback,useEffect,useRef,useState,type Dispatch,type SetStateAction} from 'react';
import {createPortal} from 'react-dom';
import {displayMessage} from '@/lib/displayMessage';
type Kind='error'|'success'|'info';
type InputKind=Kind|'status';
type Feedback={message:string;kind:Kind};
const EVENT='app-feedback-popup';
/** A presentation-only state wrapper. Values and server logging are unchanged. */
export function useFeedbackState<T extends string|null>(initial:T,kind:InputKind):[T,Dispatch<SetStateAction<T>>]{
 const [value,setValue]=useState<T>(initial);
 const set=useCallback<Dispatch<SetStateAction<T>>>((next)=>{
   if(typeof next==='string'&&next.trim()&&!/generating PDF/i.test(next)){const resolved:Kind=kind==='status'?(/unable|could not|failed|no tables|add at least|select a confirmed|locked|not connected/i.test(next)?'error':/already exists|only one|attach the downloaded|not attached automatically/i.test(next)?'info':'success'):kind;window.dispatchEvent(new CustomEvent<Feedback>(EVENT,{detail:{message:next,kind:resolved}}))}
   setValue(next);
 },[kind]);
 return [value,set];
}
export function FeedbackPopupHost(){
 const [current,setCurrent]=useState<Feedback|null>(null);const queue=useRef<Feedback[]>([]);const active=useRef(false),previous=useRef<HTMLElement|null>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{const show=(e:Event)=>{const feedback=(e as CustomEvent<Feedback>).detail;if(!feedback?.message)return;if(active.current){queue.current.push(feedback);return}active.current=true;previous.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setCurrent(feedback)};window.addEventListener(EVENT,show);return()=>window.removeEventListener(EVENT,show)},[]);
 useEffect(()=>{if(current)button.current?.focus()},[current]);
 const close=()=>{const next=queue.current.shift();if(next)setCurrent(next);else{active.current=false;setCurrent(null);previous.current?.focus()}};
 if(!current||typeof document==='undefined')return null;
 return createPortal(<div className="feedback-overlay" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){e.preventDefault();button.current?.focus()}}}><div className="feedback-dialog" role="alertdialog" aria-modal="true" aria-labelledby="feedback-title" aria-describedby="feedback-message"><div className="feedback-head"><div><small>NOTIFICATION</small><h2 id="feedback-title">{current.kind==='error'?'Unable to complete':current.kind==='info'?'Notice':'Success'}</h2></div><button type="button" className="feedback-close" onClick={close} aria-label="Close">×</button></div><div className="feedback-body"><div className={'feedback-icon '+(current.kind==='error'?'feedback-error':'')} aria-hidden="true">{current.kind==='success'?'✓':'!'}</div><p id="feedback-message">{displayMessage(current.message)}</p></div><div className="feedback-actions"><button ref={button} type="button" onClick={close}>OK</button></div></div><style>{`.feedback-overlay{position:fixed;inset:0;z-index:11000;background:rgba(35,24,15,.56);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}.feedback-dialog{width:min(480px,100%);background:#fffdf9;border:1px solid #e3d3bd;border-radius:14px;box-shadow:0 24px 70px #2e1c1060;overflow:hidden;color:#45301d;font-family:Inter,system-ui,sans-serif}.feedback-head{background:linear-gradient(100deg,#45301d,#806047);color:white;padding:17px 20px;display:flex;justify-content:space-between;align-items:flex-start}.feedback-head small{font-size:10px;letter-spacing:1.1px;font-weight:800;color:#dbc8ad}.feedback-head h2{font-size:18px;margin:5px 0 0}.feedback-close{border:0;background:transparent;color:white;font-size:24px;line-height:1;cursor:pointer}.feedback-body{display:flex;gap:14px;align-items:flex-start;padding:24px 20px}.feedback-body p{line-height:1.6;margin:1px 0;white-space:pre-wrap;font-size:14px}.feedback-icon{width:34px;height:34px;flex:none;display:grid;place-items:center;border-radius:50%;background:#e8f3e7;color:#317548;font-size:18px;font-weight:800}.feedback-icon.feedback-error{background:#fff0ee;color:#a33535}.feedback-actions{display:flex;justify-content:flex-end;padding:13px 20px;background:#f8f1e8;border-top:1px solid #eee2d3}.feedback-actions button{border:1px solid #684830;border-radius:8px;padding:10px 18px;font-weight:700;color:white;background:#684830;cursor:pointer}.feedback-actions button:focus-visible,.feedback-close:focus-visible{outline:3px solid #c99a66;outline-offset:2px}`}</style></div>,document.body)
}
