import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apresentação Oficial · Painel de Currículos | Motion Graphics & Áudio',
  description:
    'Apresentação cinematográfica com Motion Graphics, trilha sonora sintetizada em Web Audio API e demonstração completa da arquitetura do Painel de Currículos.',
};

export default function ApresentacaoPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, overflow: 'hidden', background: '#07070a' }}>
      <iframe
        src="/apresentacao.html"
        title="Apresentação Oficial · Painel de Currículos"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        allow="autoplay; camera; microphone"
      />
    </div>
  );
}
