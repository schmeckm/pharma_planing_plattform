/**
 * LLM client — OpenAI-compatible (OpenAI direct or Azure OpenAI).
 * Uses native fetch (Node 20+). No SDK required.
 */

function getConfig() {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  const mode = (process.env.COPILOT_MODE || process.env.LLM_MODE || 'hybrid').toLowerCase();
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '');
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.AZURE_OPENAI_CHAT_DEPLOYMENT;
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiBase = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const chatModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const azureEmbedDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || embeddingModel;

  const useAzure = provider === 'azure-openai' || provider === 'azure' || (!!azureEndpoint && !!azureKey);
  const apiKey = useAzure ? azureKey : openaiKey;
  const configured = !!(apiKey && (useAzure ? azureDeployment : true));

  return {
    provider: useAzure ? 'azure-openai' : 'openai',
    mode,
    configured,
    chatModel: useAzure ? azureDeployment : chatModel,
    embeddingModel: useAzure ? azureEmbedDeployment : embeddingModel,
    apiKey,
    useAzure,
    azureEndpoint,
    azureDeployment,
    openaiBase,
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
    fallbackToRules: process.env.LLM_FALLBACK_TO_RULES !== 'false',
    logPrompts: process.env.LLM_LOG_PROMPTS === 'true',
  };
}

function isLlmConfigured() {
  return getConfig().configured;
}

function isLlmAgentsEnabled() {
  return process.env.AGENT_LLM_ENABLED !== 'false' && isLlmConfigured();
}

function chatUrl(cfg) {
  if (cfg.useAzure) {
    const ver = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
    return `${cfg.azureEndpoint}/openai/deployments/${cfg.chatModel}/chat/completions?api-version=${ver}`;
  }
  return `${cfg.openaiBase}/chat/completions`;
}

function embedUrl(cfg) {
  if (cfg.useAzure) {
    const ver = process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview';
    return `${cfg.azureEndpoint}/openai/deployments/${cfg.embeddingModel}/embeddings?api-version=${ver}`;
  }
  return `${cfg.openaiBase}/embeddings`;
}

function authHeaders(cfg) {
  if (cfg.useAzure) {
    return { 'api-key': cfg.apiKey, 'Content-Type': 'application/json' };
  }
  return { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' };
}

async function chat(messages, options = {}) {
  const cfg = getConfig();
  if (!cfg.configured) {
    throw new Error('LLM not configured — set OPENAI_API_KEY or AZURE_OPENAI_*');
  }

  const body = {
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? cfg.maxTokens,
  };
  if (options.json) {
    body.response_format = { type: 'json_object' };
  }

  if (cfg.logPrompts) {
    console.log('[LLM] chat request', JSON.stringify({ model: cfg.chatModel, messageCount: messages.length }));
  }

  const res = await fetch(chatUrl(cfg), {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM chat failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (options.json) {
    try {
      return JSON.parse(content);
    } catch {
      throw new Error('LLM returned invalid JSON');
    }
  }
  return content;
}

async function embed(texts) {
  const cfg = getConfig();
  if (!cfg.configured) return null;

  const input = Array.isArray(texts) ? texts : [texts];
  const res = await fetch(embedUrl(cfg), {
    method: 'POST',
    headers: authHeaders(cfg),
    body: JSON.stringify({ input, model: cfg.embeddingModel }),
  });

  if (!res.ok) {
    console.warn('[LLM] embedding failed', res.status);
    return null;
  }

  const data = await res.json();
  return data.data?.map((d) => d.embedding) || null;
}

function getLlmStatus() {
  const cfg = getConfig();
  return {
    configured: cfg.configured,
    provider: cfg.provider,
    mode: cfg.mode,
    agentLlmEnabled: isLlmAgentsEnabled(),
    chatModel: cfg.configured ? cfg.chatModel : null,
    embeddingModel: cfg.configured ? cfg.embeddingModel : null,
    fallbackToRules: cfg.fallbackToRules,
    ragEnabled: process.env.RAG_ENABLED !== 'false',
  };
}

module.exports = {
  getConfig,
  isLlmConfigured,
  isLlmAgentsEnabled,
  chat,
  embed,
  getLlmStatus,
};
