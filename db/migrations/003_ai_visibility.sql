-- Monthly AI visibility panel (SPEC §11): 150 es + 50 en prompts on ChatGPT, Perplexity, Gemini, Claude, Copilot, Google AI Mode.
create table ai_visibility_runs (
  id bigserial primary key,
  run_month date not null,                      -- first day of the month
  engine text not null check (engine in ('chatgpt','perplexity','gemini','claude','copilot','google_ai_mode')),
  prompt_id text not null,                      -- ids from monitoring/prompts.json
  cited boolean not null, cited_url text, position smallint,
  accuracy text check (accuracy in ('accurate','partial','inaccurate')), notes text,
  unique (run_month, engine, prompt_id)
);
