import AgentChat from '../../components/AgentChat';

export default function Page(){
  return (
    <main>
      <section style={{maxWidth: '900px', margin: '0 auto'}}>
        <h1 style={{fontSize:'clamp(3.426rem, 3.426rem + ((1vw - 0.2rem) * 6.498), 7rem)', fontWeight:700, textAlign:'center', color:'#ffffff', marginBottom:'0.75rem', marginTop: '1.2rem'}}>RyanGPT ✨</h1>
        <p style={{textAlign:'center', color:'#babfcb', marginBottom:'3rem'}}>Curious about my product process, design background, or specific projects? Ask below.</p>
        <AgentChat />
      </section>
    </main>
  );
}