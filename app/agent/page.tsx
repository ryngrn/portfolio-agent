import AgentChat from '../../components/AgentChat';
import { chatThemes, getChatMode } from '../../config/chatThemes';

export default function Page({ searchParams }: { searchParams?: { mode?: string } }){
  const mode = getChatMode(searchParams?.mode);
  const theme = chatThemes[mode];

  return (
    <main style={{ minHeight: '100dvh', background: theme.pageBackground }}>
      <section style={{maxWidth: '900px', margin: '0 auto'}}>
        <AgentChat mode={mode} />
      </section>
    </main>
  );
}
