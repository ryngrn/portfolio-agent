import AgentChat from '@/components/AgentChat';

export default function Page(){
  return (
    <main style={{minHeight:'100vh', padding:'2rem 1rem'}}>
      <section style={{maxWidth: '900px', margin: '0 auto'}}>
        <h1 style={{fontSize:'2rem', fontWeight:600, textAlign:'center', marginBottom:'0.75rem'}}>Ask Me Anything (About My Work)</h1>
        <p style={{textAlign:'center', color:'#6b7280', marginBottom:'1.5rem'}}>Curious about my product process, design background, or specific projects? Ask below.</p>
        <AgentChat />
      </section>
    </main>
  );
}
