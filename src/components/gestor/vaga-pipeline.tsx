"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type React from "react";
import type { AIState } from "@prisma/client";
import { bulkSetApplicationStatusAction, moveApplicationAction } from "@/server/controllers/application.controller";
import { appStatusLabels, formatWaiting, type AppStatusKey } from "@/server/models/application.model";
import { CandidateAvatar } from "@/components/gestor/candidate-avatar";
import { AiScoreChip } from "@/components/gestor/ai-score-chip";
import { Toast } from "@/components/gestor/toast";
import { inAgeRange } from "@/server/models/age.model";
import { BulkRejectDialog } from "@/components/gestor/bulk-reject-dialog";
import { StageMoveDialog, type MoveNoticeChoice } from "@/components/gestor/stage-move-dialog";

const STAGES: { key: AppStatusKey; label: string; accent: string; hint: string }[] = [
  { key: "PENDING", label: "Triagem", accent: "#b07818", hint: "Novas candidaturas" },
  { key: "SHORTLISTED", label: "Passou da triagem", accent: "#2f5fa8", hint: "Prontos para chamar" },
  { key: "INTERVIEW", label: "Entrevista", accent: "#b07818", hint: "Em conversa" },
  { key: "STANDBY", label: "Stand-by", accent: "#0e7a6b", hint: "Guardados p/ depois" },
  { key: "APPROVED", label: "Aprovados", accent: "#1f7a4d", hint: "Prontos para avançar" },
  { key: "REJECTED", label: "BANCO DE DADOS", accent: "#a1a1aa", hint: "Disponível no banco" },
];
type PipelinePerson = { id:string; name:string; status:AppStatusKey; aiScore:number|null; aiState:AIState|null; createdAt:string; photoUrl?:string|null; age?:number|null };

export function VagaPipeline({ applications, aiMinScore, jobId, jobTitle, companyName, templates }: {
  applications: PipelinePerson[]; aiMinScore:number;
  jobId:string; jobTitle:string; companyName:string;
  templates:{ id:string; subject:string; body:string }[];
}) {
  const [rejectOpen,setRejectOpen]=useState(false);
  const [people,setPeople]=useState(applications);
  const [draggingId,setDraggingId]=useState<string|null>(null);
  const [overStage,setOverStage]=useState<AppStatusKey|null>(null);
  // Movimento aguardando confirmação: a caixa mostra o que o candidato vai receber.
  const [confirm,setConfirm]=useState<{id:string;name:string;from:AppStatusKey;stage:AppStatusKey}|null>(null);
  const [toast,setToast]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  // Filtro de idade: só muda o que aparece no funil. Idade nunca entra na nota nem vai para a IA.
  const [ageOpen,setAgeOpen]=useState(false);
  const [ageMin,setAgeMin]=useState("");
  const [ageMax,setAgeMax]=useState("");
  const [hideUnknown,setHideUnknown]=useState(false);
  const toAge=(v:string)=>{const n=parseInt(v,10);return Number.isFinite(n)&&n>0?n:null;};
  const range={min:toAge(ageMin),max:toAge(ageMax),hideUnknown};
  const ageFiltering=range.min!==null||range.max!==null;
  const visible=people.filter(p=>inAgeRange(p.age??null,range));
  const hiddenByAge=people.length-visible.length;

  function move(id:string,stage:AppStatusKey,notice:MoveNoticeChoice){
    const person=people.find(p=>p.id===id); if(!person||person.status===stage)return;
    setDraggingId(null); setOverStage(null);
    const previous=people;
    startTransition(async()=>{
      try{
        const result=await moveApplicationAction(id,stage,notice);
        if(!result.ok){setToast(result.error);return;}
        setPeople(current=>current.map(p=>p.id===id?{...p,status:stage}:p));
        setConfirm(null);
        const aviso=notice.mode==="silent"?" (sem aviso)":notice.mode==="custom"?" com a sua mensagem":"";
        setToast(`${person.name} → ${appStatusLabels[stage]}${aviso}.`);
      }catch{setPeople(previous);setToast("Não foi possível mover o candidato. Tente novamente.");}
    });
  }
  /** Quem está na triagem e já atingiu a nota mínima da vaga: passa todos de uma vez. */
  const ready=visible.filter(p=>p.status==="PENDING"&&p.aiScore!==null&&p.aiScore>=aiMinScore);
  function passAllReady(){
    if(ready.length===0||!window.confirm(`Passar ${ready.length} candidato${ready.length===1?"":"s"} que atingiram a nota mínima (${aiMinScore}) para "Passou da triagem"?`))return;
    const ids=ready.map(p=>p.id); const previous=people;
    setPeople(current=>current.map(p=>ids.includes(p.id)?{...p,status:"SHORTLISTED"}:p));
    startTransition(async()=>{try{let updated=0;for(let i=0;i<ids.length;i+=100)updated+=(await bulkSetApplicationStatusAction(ids.slice(i,i+100),"SHORTLISTED")).updated;setToast(`${updated} candidato${updated===1?"":"s"} passou${updated===1?"":"ram"} da triagem.`);}catch{setPeople(previous);setToast("Não foi possível passar os candidatos. Tente novamente.");}});
  }
  /** Quem ainda está na triagem (respeita o filtro de idade): mover para banco de dados de uma vez, com mensagem. */
  const stillPending=visible.filter(p=>p.status==="PENDING");
  function onBulkRejected(ids:string[]){
    if(ids.length===0)return;
    setPeople(current=>current.map(p=>ids.includes(p.id)?{...p,status:"REJECTED"}:p));
    setToast(`${ids.length} candidato${ids.length===1?"":"s"} movido${ids.length===1?"":"s"} para o banco de dados com a mensagem enviada.`);
  }
  function askMove(id:string,stage:AppStatusKey){
    const person=people.find(p=>p.id===id); if(!person||person.status===stage)return;
    setDraggingId(null); setOverStage(null);
    setConfirm({id,name:person.name,from:person.status,stage});
  }
  function onDragStart(e:React.DragEvent<HTMLElement>,id:string){setDraggingId(id);e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain",id);}
  function onDrop(e:React.DragEvent<HTMLElement>,stage:AppStatusKey){e.preventDefault();const id=e.dataTransfer.getData("text/plain")||draggingId;if(id)askMove(id,stage);}

  return <>
    <div className="mt-4 rounded-2xl border border-[#e4e4e7] bg-[#f7f6f4] p-2">
      <div className="mb-2 flex items-center justify-between px-2 py-1.5"><p className="text-[11px] text-[#8a8781]">Arraste um candidato para a próxima etapa.</p><div className="flex flex-wrap items-center gap-2">{ready.length>0&&<button type="button" disabled={pending} onClick={passAllReady} className="h-8 rounded-lg px-3 text-[11px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-50" style={{backgroundColor:"var(--brand-primary)",color:"var(--brand-foreground)"}}>Passar quem atende o mínimo ({ready.length})</button>}{stillPending.length>0&&<button type="button" disabled={pending} onClick={()=>setRejectOpen(true)} className="h-8 rounded-lg border border-[#e8c4c0] bg-white px-3 text-[11px] font-semibold text-[#c23b3b] transition hover:bg-[#fbeae8] disabled:opacity-50">Mover da triagem para Banco de dados ({stillPending.length})</button>}</div><span className="hidden text-[10px] font-medium text-[#aaa39c] sm:block">{pending?"Salvando movimento…":"Drag & drop ativo"}</span></div>
      <div className="mb-2 px-2">
        <button type="button" onClick={()=>setAgeOpen(o=>!o)} className="text-[11px] font-medium text-[#8a8781] hover:text-[#0a0a0a]" aria-expanded={ageOpen}>{ageFiltering?`Idade: ${range.min??"…"} a ${range.max??"…"} anos${hiddenByAge>0?` · ${hiddenByAge} oculto${hiddenByAge===1?"":"s"}`:""}`:"Filtrar por idade"} {ageOpen?"▴":"▾"}</button>
        {ageOpen&&<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-white px-3 py-2 text-[12px] text-[#57534e]">
          <label className="flex items-center gap-1.5">De<input type="number" inputMode="numeric" min={14} max={99} value={ageMin} onChange={e=>setAgeMin(e.target.value)} className="h-7 w-16 rounded-md border border-[#e4e4e7] px-2 text-[12px]" placeholder="18"/></label>
          <label className="flex items-center gap-1.5">até<input type="number" inputMode="numeric" min={14} max={99} value={ageMax} onChange={e=>setAgeMax(e.target.value)} className="h-7 w-16 rounded-md border border-[#e4e4e7] px-2 text-[12px]" placeholder="35"/>anos</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={hideUnknown} onChange={e=>setHideUnknown(e.target.checked)}/>Ocultar quem não informou a idade</label>
          {(ageFiltering||hideUnknown)&&<button type="button" onClick={()=>{setAgeMin("");setAgeMax("");setHideUnknown(false);}} className="font-medium underline underline-offset-2">Limpar</button>}
          <span className="text-[11px] text-[#a1a1aa]">Só muda o que você vê aqui. A idade não entra na nota.</span>
        </div>}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {STAGES.map(stage=>{const rows=visible.filter(p=>p.status===stage.key);const active=overStage===stage.key&&draggingId!==null;return <section key={stage.key} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="move";setOverStage(stage.key)}} onDragEnter={()=>setOverStage(stage.key)} onDrop={e=>onDrop(e,stage.key)} className={`min-h-[238px] rounded-xl border bg-white transition-all ${active?"border-[#811201] bg-[#fffaf8] shadow-[0_0_0_3px_rgba(129,18,1,0.08)]":"border-[#e4e4e7]"}`}>
          <header className="flex items-center justify-between border-b border-[#e4e4e7] px-3.5 py-3"><div><div className="flex items-center gap-2"><span className="text-[13px] font-semibold text-[#0a0a0a]">{stage.label}</span><span className="rounded-full bg-[#f1f0ed] px-2 text-[10px] font-semibold" style={{color:stage.accent}}>{rows.length}</span></div><p className="mt-0.5 text-[9px] text-[#aaa39c]">{stage.hint}</p></div>{active&&<span className="rounded-full bg-[#811201]/[0.08] px-2 py-1 text-[9px] font-semibold text-[#811201]">Soltar aqui</span>}</header>
          <div className="space-y-2 p-2">
            {rows.length===0&&<div className={`flex min-h-[120px] items-center justify-center rounded-lg border border-dashed text-center ${active?"border-[#811201]/30 text-[#811201]":"border-[#e8e5e1] text-[#b4aea8]"}`}><span className="text-[11px]">{active?"Solte para mover":"Nenhum candidato"}</span></div>}
            {rows.map(person=><div key={person.id} draggable onDragStart={e=>onDragStart(e,person.id)} onDragEnd={()=>{setDraggingId(null);setOverStage(null)}} className={`group rounded-xl border bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all ${draggingId===person.id?"scale-[0.98] border-[#811201]/30 opacity-45":"border-[#e8e5e1] hover:-translate-y-0.5 hover:border-[#d4d0ca] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]"}`}>
              <div className="flex items-start gap-2.5"><CandidateAvatar name={person.name} photoUrl={person.photoUrl} className="pointer-events-none mt-0.5 flex size-8 shrink-0 cursor-grab items-center justify-center rounded-full bg-[#1c1917] text-[9px] font-bold text-white active:cursor-grabbing" /><Link href={"/candidaturas/"+person.id} draggable={false} title={person.age!=null?`${person.age} anos`:"Idade não informada"} className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-[#0a0a0a]">{person.name}</span>{person.age!=null&&<span className={"mt-0.5 block text-[10px] text-[#a1a1aa] transition-opacity "+(ageFiltering?"opacity-100":"opacity-0 group-hover:opacity-100")}>{person.age} anos</span>}{stage.key==="PENDING"&&<span className="mt-0.5 block text-[10px] font-medium text-[#b07818]">espera {formatWaiting(new Date(person.createdAt))}</span>}</Link><span className="select-none text-[13px] text-[#c5c0bb] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>⋮⋮</span></div>
              <div className="mt-2 flex items-center justify-between gap-2"><AiScoreChip aiScore={person.aiScore} aiState={person.aiState ?? "WAITING"} meetsMinimum={person.aiScore!==null&&person.aiScore>=aiMinScore}/><Link href={"/candidaturas/"+person.id} draggable={false} className="text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100" style={{color:"var(--brand-primary)"}}>Abrir ›</Link></div>
            </div>)}
          </div>
        </section>})}
      </div>
    </div>
    {rejectOpen&&<BulkRejectDialog jobId={jobId} jobTitle={jobTitle} companyName={companyName} templates={templates}
      candidates={stillPending.map(p=>({id:p.id,name:p.name,aiScore:p.aiScore,photoUrl:p.photoUrl,analyzing:p.aiState==="WAITING"||p.aiState==="PROCESSING"}))}
      onClose={()=>setRejectOpen(false)} onDone={onBulkRejected}/>}
    {confirm&&<StageMoveDialog candidateName={confirm.name} from={confirm.from} to={confirm.stage} companyName={companyName} jobTitle={jobTitle}
      pending={pending} onCancel={()=>setConfirm(null)} onConfirm={(notice)=>move(confirm.id,confirm.stage,notice)}/>}
    {toast&&<Toast message={toast} onDone={()=>setToast(null)}/>}
  </>;
}
