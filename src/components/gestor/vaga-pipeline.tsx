"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type React from "react";
import type { AIState } from "@prisma/client";
import { setApplicationStatusAction } from "@/server/controllers/application.controller";
import { appStatusLabels, formatWaiting, type AppStatusKey } from "@/server/models/application.model";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { Toast } from "@/components/gestor/toast";

const STAGES: { key: AppStatusKey; label: string; accent: string; hint: string }[] = [
  { key: "PENDING", label: "Triagem", accent: "#b07818", hint: "Novas candidaturas" },
  { key: "INTERVIEW", label: "Entrevista", accent: "#b07818", hint: "Em conversa" },
  { key: "APPROVED", label: "Aprovados", accent: "#1f7a4d", hint: "Prontos para avançar" },
  { key: "REJECTED", label: "Reprovados", accent: "#a1a1aa", hint: "Fora do processo" },
];
type PipelinePerson = { id:string; name:string; status:AppStatusKey; aiScore:number|null; aiState:AIState|null; createdAt:string; photoUrl?:string|null };

export function VagaPipeline({ applications, aiMinScore }: { applications: PipelinePerson[]; aiMinScore:number }) {
  const [people,setPeople]=useState(applications);
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const [overStage,setOverStage]=useState<AppStatusKey|null>(null);
  const [confirm,setConfirm]=useState<{id:string;name:string;stage:AppStatusKey}|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();

  function move(id:string,stage:AppStatusKey){
    const person=people.find(p=>p.id===id); if(!person||person.status===stage)return;
    setConfirm(null); setDraggingId(null); setOverStage(null);
    const previous=people; setPeople(current=>current.map(p=>p.id===id?{...p,status:stage}:p));
    startTransition(async()=>{try{await setApplicationStatusAction(id,stage);setToast(`${person.name} → ${appStatusLabels[stage]}.`);}catch{setPeople(previous);setToast("Não foi possível mover o candidato. Tente novamente.");}});
  }
  function askMove(id:string,stage:AppStatusKey){
    const person=people.find(p=>p.id===id); if(!person||person.status===stage)return;
    if(stage==="REJECTED"){setConfirm({id,name:person.name,stage});return;} move(id,stage);
  }
  function onDragStart(e:React.DragEvent<HTMLElement>,id:string){setDraggingId(id);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",id);}
  function onDrop(e:React.DragEvent<HTMLElement>,stage:AppStatusKey){e.preventDefault();const id=e.dataTransfer.getData("text/plain")||draggingId;if(id)askMove(id,stage);}

  return <>
    <div className="mt-4 rounded-2xl border border-[#e4e4e7] bg-[#f7f6f4] p-2">
      <div className="mb-2 flex items-center justify-between px-2 py-1.5"><p className="text-[11px] text-[#8a8781]">Arraste um candidato para a próxima etapa.</p><span className="hidden text-[10px] font-medium text-[#aaa39c] sm:block">{pending?"Salvando movimento…":"Drag & drop ativo"}</span></div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map(stage=>{const rows=people.filter(p=>p.status===stage.key);const active=overStage===stage.key&&draggingId!==null;return <section key={stage.key} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";setOverStage(stage.key)}} onDragEnter={()=>setOverStage(stage.key)} onDrop={e=>onDrop(e,stage.key)} className={`min-h-[238px] rounded-xl border bg-white transition-all ${active?"border-[#811201] bg-[#fffaf8] shadow-[0_0_0_3px_rgba(129,18,1,0.08)]":"border-[#e4e4e7]"}`}>
          <header className="flex items-center justify-between border-b border-[#e4e4e7] px-3.5 py-3"><div><div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[#0a0a0a]">{stage.label}</span><span className="rounded-full bg-[#f1f0ed] px-2 text-[10px] font-semibold" style={{color:stage.accent}}>{rows.length}</span></div><p className="mt-0.5 text-[9px] text-[#aaa39c]">{stage.hint}</p></div>{active&&<span className="rounded-full bg-[#811201]/[0.08] px-2 py-1 text-[9px] font-semibold text-[#811201]">Soltar aqui</span>}</header>
          <div className="space-y-2 p-2">
            {rows.length===0&&<div className={`flex min-h-[120px] items-center justify-center rounded-lg border border-dashed text-center ${active?"border-[#811201]/30 text-[#811201]":"border-[#e8e5e1] text-[#b4aea8]"}`}><span className="text-[11px]">{active?"Solte para mover":"Nenhum candidato"}</span></div>}
            {rows.map(person=><div key={person.id} draggable onDragStart={e=>onDragStart(e,person.id)} onDragEnd={()=>{setDraggingId(null);setOverStage(null)}} className={`group rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all ${draggingId===person.id?"scale-[0.98] border-[#811201]/30 opacity-45":"border-[#e8e5e1] hover:-translate-y-0.5 hover:border-[#d4d0ca] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]"}`}>
              <div className="flex items-start gap-2.5"><CandidateAvatar name={person.name} photoUrl={person.photoUrl} className="pointer-events-none mt-0.5 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-full bg-[#1c1917] text-[9px] font-bold text-white active:cursor-grabbing" /><Link href={"/candidaturas/"+person.id} draggable={false} className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-[#0a0a0a]">{person.name}</span>{stage.key==="PENDING"&&<span className="mt-0.5 block text-[10px] font-medium text-[#b07818]">espera {formatWaiting(new Date(person.createdAt))}</span>}</Link><span className="select-none text-[13px] text-[#c5c0bb] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>⋮⋮</span></div>
              <div className="mt-2 flex items-center justify-between gap-2"><AiScoreChip aiScore={person.aiScore} aiState={person.aiState ?? "WAITING"} meetsMinimum={person.aiScore!==null&&person.aiScore>=aiMinScore}/><Link href={"/candidaturas/"+person.id} draggable={false} className="text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100" style={{color:"var(--brand-primary)"}}>Abrir ›</Link></div>
            </div>)}
          </div>
        </section>})}
      </div>
    </div>
    {confirm&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-5" role="dialog" aria-modal="true" onClick={()=>setConfirm(null)}><div className="w-full max-w-[390px] rounded-2xl bg-white p-6 shadow-2xl" onClick={e=>e.stopPropagation()}><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">Mover candidato</p><h3 className="mt-2 text-lg font-semibold text-[#0a0a0a]">Reprovar {confirm.name}?</h3><p className="mt-2 text-sm leading-6 text-[#71717a]">O candidato será retirado do funil ativo. Confirme apenas se esta for a decisão.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={()=>setConfirm(null)} className="h-10 rounded-xl border border-[#e4e4e7] px-4 text-[13px] font-medium text-[#57534e]">Cancelar</button><button type="button" disabled={pending} onClick={()=>move(confirm.id,confirm.stage)} className="h-10 rounded-xl bg-[#c23b3b] px-4 text-[13px] font-semibold text-white disabled:opacity-50">Reprovar candidato</button></div></div></div>}
    {toast&&<Toast message={toast} onDone={()=>setToast(null)}/>}
  </>;
}
