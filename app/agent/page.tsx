import AgentChat from '../../components/AgentChat';

export default function Page(){
  return (
    <main>
      <section style={{maxWidth: '900px', margin: '0 auto'}}>
        <h1 style={{fontSize:'3rem', fontWeight:600, textAlign:'center', color:'#ffffff', marginBottom:'0.75rem'}}>RyanGPT ✨</h1>
        <p style={{textAlign:'center', color:'#babfcb', marginBottom:'1.5rem'}}>Curious about my product process, design background, or specific projects? Ask below.</p>
        <AgentChat />
      </section>
    </main>
  );
}
