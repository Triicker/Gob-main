const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store"
};

const MAX_BODY_BYTES = 25_000;
const FIELD_LIMITS = {
  nome: 120,
  telefone: 40,
  email: 254,
  instituicao: 200,
  cidade: 160,
  mensagem: 4_000,
  website: 200
};

const DISTRIBUTOR_FIELD_LIMITS = {
  nome: 120,
  contato: 40,
  cidade: 160,
  uf: 2,
  empresa: 200,
  cnpj: 30,
  hist1: 500,
  cliente1: 200,
  ano1: 20,
  hist2: 500,
  cliente2: 200,
  ano2: 20,
  hist3: 500,
  cliente3: 200,
  ano3: 20,
  hist4: 500,
  cliente4: 200,
  ano4: 20,
  hist5: 500,
  cliente5: 200,
  ano5: 20,
  foco: 30,
  cid1: 160,
  uf_cid1: 2,
  cid2: 160,
  uf_cid2: 2,
  cid3: 160,
  uf_cid3: 2,
  cid4: 160,
  uf_cid4: 2,
  cid5: 160,
  uf_cid5: 2,
  mensagem: 4_000,
  bot_field: 200
};

const DISTRIBUTOR_TYPE_OPTIONS = new Set([
  "Representante",
  "Distribuidor",
  "Formador",
  "Livraria"
]);
const DISTRIBUTOR_FOCUS_OPTIONS = new Set(["Rede pública", "Rede privada"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Método não permitido." }, 405, {
          Allow: "POST"
        });
      }

      return handleContact(request, env);
    }

    if (url.pathname === "/api/distributor") {
      if (request.method !== "POST") {
        return jsonResponse(
          { error: "Método não permitido." },
          405,
          { Allow: "POST" }
        );
      }

      return handleDistributor(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleContact(request, env) {
  try {
    const parsedBody = await readLimitedJson(request);
    if (parsedBody.response) return parsedBody.response;

    const fields = normalizeFields(parsedBody.payload);
    if (!fields || !isValidEmail(fields.email)) {
      return jsonResponse({ error: "Preencha os campos obrigatórios." }, 400);
    }

    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) {
      console.error("Contact configuration error: missing Resend environment variables.");
      return jsonResponse({ error: "Erro interno." }, 500);
    }

    const resendPayload = {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      reply_to: fields.email,
      subject: `Novo contato pelo site - ${sanitizeSubject(fields.nome)}`,
      html: buildEmailHtml(fields)
    };

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resendPayload)
      });
    } catch (error) {
      console.error("Resend request error:", safeErrorMessage(error));
      return jsonResponse({ error: "Erro ao enviar e-mail." }, 500);
    }

    const resendData = await readJsonSafely(resendResponse);
    if (!resendResponse.ok) {
      console.error("Resend error:", {
        status: resendResponse.status,
        data: resendData
      });
      return jsonResponse({ error: "Erro ao enviar e-mail." }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Contact endpoint error:", safeErrorMessage(error));
    return jsonResponse({ error: "Erro interno." }, 500);
  }
}

async function handleDistributor(request, env) {
  try {
    const parsedBody = await readLimitedJson(request);
    if (parsedBody.response) return parsedBody.response;

    const fields = normalizeDistributorFields(parsedBody.payload);
    if (!fields) {
      return jsonResponse({ error: "Preencha os campos obrigatórios." }, 400);
    }

    if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) {
      console.error("Distributor configuration error: missing Resend environment variables.");
      return jsonResponse({ error: "Erro interno." }, 500);
    }

    const resendPayload = {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject: `Nova solicitação de distribuidor - ${sanitizeSubject(fields.nome)}`,
      html: buildDistributorEmailHtml(fields)
    };

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(resendPayload)
      });
    } catch (error) {
      console.error("Resend request error:", safeErrorMessage(error));
      return jsonResponse({ error: "Erro ao enviar e-mail." }, 500);
    }

    const resendData = await readJsonSafely(resendResponse);
    if (!resendResponse.ok) {
      console.error("Resend error:", {
        status: resendResponse.status,
        data: resendData
      });
      return jsonResponse({ error: "Erro ao enviar e-mail." }, 500);
    }

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Distributor endpoint error:", safeErrorMessage(error));
    return jsonResponse({ error: "Erro interno." }, 500);
  }
}

function normalizeFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const fields = {};
  for (const [name, limit] of Object.entries(FIELD_LIMITS)) {
    const value = payload[name];
    if (value !== undefined && typeof value !== "string") {
      return null;
    }

    fields[name] = String(value || "").trim();
    if (fields[name].length > limit) {
      return null;
    }
  }

  if (
    !fields.nome ||
    !fields.telefone ||
    !fields.email ||
    !fields.mensagem ||
    fields.website
  ) {
    return null;
  }

  return fields;
}

function normalizeDistributorFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  if (!Array.isArray(payload.tipo) || payload.tipo.length === 0) {
    return null;
  }

  const tipo = [];
  for (const value of payload.tipo) {
    if (
      typeof value !== "string" ||
      !DISTRIBUTOR_TYPE_OPTIONS.has(value) ||
      tipo.includes(value)
    ) {
      return null;
    }
    tipo.push(value);
  }

  const fields = { tipo };
  for (const [name, limit] of Object.entries(DISTRIBUTOR_FIELD_LIMITS)) {
    const value = payload[name];
    if (value !== undefined && typeof value !== "string") {
      return null;
    }

    fields[name] = String(value || "").trim();
    if (fields[name].length > limit) {
      return null;
    }
  }

  if (
    !fields.nome ||
    !fields.contato ||
    !fields.cidade ||
    !fields.uf ||
    !DISTRIBUTOR_FOCUS_OPTIONS.has(fields.foco) ||
    fields.bot_field
  ) {
    return null;
  }

  if (!/^[A-Za-z]{2}$/.test(fields.uf)) {
    return null;
  }

  for (let index = 1; index <= 5; index += 1) {
    const state = fields[`uf_cid${index}`];
    if (state && !/^[A-Za-z]{2}$/.test(state)) {
      return null;
    }
  }

  return fields;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeSubject(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function buildEmailHtml(fields) {
  const optional = (value) => escapeHtml(value || "Não informado");

  return `
    <h1>Novo contato pelo site</h1>
    <p><strong>Nome:</strong> ${escapeHtml(fields.nome)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(fields.email)}</p>
    <p><strong>Telefone:</strong> ${optional(fields.telefone)}</p>
    <p><strong>Instituição:</strong> ${optional(fields.instituicao)}</p>
    <p><strong>Cidade:</strong> ${optional(fields.cidade)}</p>
    <p><strong>Mensagem:</strong></p>
    <p>${escapeHtml(fields.mensagem).replaceAll("\n", "<br>")}</p>
  `;
}

function buildDistributorEmailHtml(fields) {
  const labels = {
    nome: "Nome",
    contato: "Contato WhatsApp",
    cidade: "Cidade",
    uf: "UF",
    empresa: "Empresa",
    cnpj: "CNPJ",
    hist1: "Histórico 1",
    cliente1: "Cliente 1",
    ano1: "Ano 1",
    hist2: "Histórico 2",
    cliente2: "Cliente 2",
    ano2: "Ano 2",
    hist3: "Histórico 3",
    cliente3: "Cliente 3",
    ano3: "Ano 3",
    hist4: "Histórico 4",
    cliente4: "Cliente 4",
    ano4: "Ano 4",
    hist5: "Histórico 5",
    cliente5: "Cliente 5",
    ano5: "Ano 5",
    foco: "Foco",
    cid1: "Cidade de atuação 1",
    uf_cid1: "UF de atuação 1",
    cid2: "Cidade de atuação 2",
    uf_cid2: "UF de atuação 2",
    cid3: "Cidade de atuação 3",
    uf_cid3: "UF de atuação 3",
    cid4: "Cidade de atuação 4",
    uf_cid4: "UF de atuação 4",
    cid5: "Cidade de atuação 5",
    uf_cid5: "UF de atuação 5",
    mensagem: "Mensagem"
  };

  const rows = [
    `<p><strong>Tipo:</strong> ${fields.tipo.map(escapeHtml).join(", ")}</p>`
  ];

  for (const [name, label] of Object.entries(labels)) {
    if (fields[name]) {
      rows.push(
        `<p><strong>${label}:</strong> ${escapeHtml(fields[name]).replaceAll("\n", "<br>")}</p>`
      );
    }
  }

  return `<h1>Nova solicitação de distribuidor</h1>${rows.join("")}`;
}

async function readLimitedJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return {
      response: jsonResponse({ error: "Requisição muito grande." }, 413)
    };
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return { response: jsonResponse({ error: "JSON inválido." }, 400) };
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return {
      response: jsonResponse({ error: "Requisição muito grande." }, 413)
    };
  }

  try {
    return { payload: JSON.parse(rawBody) };
  } catch {
    return { response: jsonResponse({ error: "JSON inválido." }, 400) };
  }
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return { error: "Resposta inválida do provedor de e-mail." };
  }
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders
    }
  });
}
