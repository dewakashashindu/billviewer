"use client";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import ChefBot from "./ChefBot";
import "./assistant.css";

type Message = { id: number; text: string; role: "user" | "assistant" };
const suggestions = [
  { icon: "sales", title: "Sales overview", description: "Understand how sales are performing", prompt: "Give me an overview of today's sales." },
  { icon: "stock", title: "Inventory insights", description: "Explore stock levels and movement", prompt: "Which inventory items need my attention?" },
  { icon: "trend", title: "Business trends", description: "Compare performance over time", prompt: "Show me the sales trend for this month." },
  { icon: "forecast", title: "Forecast & planning", description: "Prepare for what's coming next", prompt: "Help me plan for next week's sales and stock." },
];
function Icon({name}:{name:string}) {return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name==='sales'?<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>:name==='stock'?<path d="M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8"/>:name==='trend'?<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>:name==='forecast'?<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>:<path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>}</svg>}
export default function AssistantPage() {
 const [draft,setDraft]=useState(""); const [messages,setMessages]=useState<Message[]>([]); const input=useRef<HTMLTextAreaElement>(null); const nextId=useRef(0); const scrollArea=useRef<HTMLDivElement>(null); const followLatest=useRef(true);
 useEffect(()=>{const area=scrollArea.current;if(area && followLatest.current) area.scrollTop=area.scrollHeight;},[messages]);
 function submit(e?:FormEvent){e?.preventDefault();const value=draft.trim();if(!value)return;followLatest.current=true;setMessages(prev=>[...prev,{id:nextId.current++,role:"user",text:value},{id:nextId.current++,role:"assistant",text:"The AI assistant is not connected yet, so I can't analyse data or provide predictions right now."}]);setDraft("");input.current?.focus();}
 function handleKey(e:KeyboardEvent<HTMLTextAreaElement>){if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}
 function selectPrompt(prompt:string){setDraft(prompt);input.current?.focus();}
 return <main className="assistant-page"><div className="assistant-backdrop" aria-hidden="true"/><div className="assistant-layout">
  <section className="assistant-intro" aria-label="Meet the assistant"><div className="assistant-eyebrow">YOUR BUSINESS COMPANION</div><h1>Meet <span>MicroEChef</span>,<br/>your AI sous-chef<br/>for the numbers.</h1><ChefBot/></section>
  <section className="assistant-frame" aria-label="AI assistant chat"><div className="assistant-frame-head"><div className="assistant-head-left"><div className="assistant-avatar"><Icon name="spark"/></div><div><strong>Business Assistant</strong><span>Sales, inventory &amp; insights</span></div></div><div className="assistant-top-actions"><button type="button" className="assistant-new" onClick={()=>{followLatest.current=true;setMessages([]);setDraft("");input.current?.focus()}}>+ New chat</button></div></div>
   <div className="assistant-content" ref={scrollArea} role="region" aria-label="Chat messages" tabIndex={0} onScroll={e=>{const el=e.currentTarget;followLatest.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;}} aria-live="polite"><div className="assistant-message-row"><div className="assistant-message-avatar" aria-hidden="true">☺</div><div className="assistant-bubble">Hello! Ask me about sales, stock levels or what is coming next.</div></div>
   {messages.length===0?<><div className="assistant-ideas-title">START WITH AN IDEA</div><div className="assistant-suggestions">{suggestions.map(s=><button type="button" className="assistant-suggestion" key={s.title} onClick={()=>selectPrompt(s.prompt)}><span className="assistant-suggestion-icon"><Icon name={s.icon}/></span><span><strong>{s.title}</strong><span>{s.description}</span></span></button>)}</div></>:<div className="assistant-messages">{messages.map(m=><div className={`assistant-message-row ${m.role}`} key={m.id}>{m.role==='assistant'&&<div className="assistant-message-avatar" aria-hidden="true">☺</div>}<div className="assistant-bubble">{m.text}</div></div>)}</div>}</div>
   <div className="assistant-composer-area"><form className="assistant-composer" onSubmit={submit}><label className="assistant-sr-only" htmlFor="assistant-question">Ask a question</label><textarea id="assistant-question" ref={input} rows={1} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={handleKey} placeholder="Ask anything about your business..."/><button type="submit" disabled={!draft.trim()} aria-label="Send message"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form></div>
  </section></div></main>;
}
