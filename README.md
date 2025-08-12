# RyanGreenGPT

1) Add your content as Markdown in `/knowledge` (edit the samples).
2) Set env vars in Netlify: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_EMBEDDING_MODEL`.
3) Deploy to Netlify. The build will generate `data/embeddings.json` automatically and publish the app.
4) Open `/agent` on your site to chat. Embed in WordPress via an iframe.

See the in-app `/app/api/agent/route.ts` for how retrieval and answering works.
