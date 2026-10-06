const JSON_HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store"
};

const MAX_BODY_BYTES = 25_000;
const VALID_UFS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT",
  "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO",
  "RR", "SC", "SP", "SE", "TO"
]);

const CONTACT_FIELD_LIMITS = {
  nome: 120,
  telefone: 40,
  email: 254,
  estado: 2,
  cidade: 160,
  instituicao: 200,
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
  ano1: 4,
  hist2: 500,
  cliente2: 200,
  ano2: 4,
  hist3: 500,
  cliente3: 200,
  ano3: 4,
  hist4: 500,
  cliente4: 200,
  ano4: 4,
  hist5: 500,
  cliente5: 200,
  ano5: 4,
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

const SCHEDULE_FIELD_LIMITS = {
  nome: 120,
  cargo: 120,
  whatsapp: 40,
  instituicao: 200,
  telefone: 40,
  estado: 2,
  cidade: 160,
  homepage: 200
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
    const pathname = new URL(request.url).pathname;
    const handlers = {
      "/api/contact": handleContact,
      "/api/distributor": handleDistributor,
      "/api/schedule": handleSchedule
    };
    const handler = handlers[pathname];

    if (handler) {
      if (request.method !== "POST") {
        return jsonResponse({ error: "Método não permitido." }, 405, { Allow: "POST" });
      }
      return handler(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function handleContact(request, env) {
  try {
    const parsedBody = await readLimitedJson(request);
    if (parsedBody.response) return parsedBody.response;

    const fields = normalizeContactFields(parsedBody.payload);
    if (!fields) return invalidFieldsResponse();

    const emailError = await sendResendEmail(env, {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      reply_to: fields.email,
      subject: `Novo contato pelo site - ${sanitizeSubject(fields.nome)}`,
      html: buildContactEmailHtml(fields)
    }, "Contact");
    if (emailError) return emailError;

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
    if (!fields) return invalidFieldsResponse();

    const emailError = await sendResendEmail(env, {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject: `Nova solicitação de distribuidor - ${sanitizeSubject(fields.nome)}`,
      html: buildDistributorEmailHtml(fields)
    }, "Distributor");
    if (emailError) return emailError;

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Distributor endpoint error:", safeErrorMessage(error));
    return jsonResponse({ error: "Erro interno." }, 500);
  }
}

async function handleSchedule(request, env) {
  try {
    const parsedBody = await readLimitedJson(request);
    if (parsedBody.response) return parsedBody.response;

    const fields = normalizeScheduleFields(parsedBody.payload);
    if (!fields) return invalidFieldsResponse();

    const emailError = await sendResendEmail(env, {
      from: env.RESEND_FROM_EMAIL,
      to: [env.RESEND_TO_EMAIL],
      subject: `Nova solicitação de cronograma - ${sanitizeSubject(fields.nome)}`,
      html: buildScheduleEmailHtml(fields)
    }, "Schedule");
    if (emailError) return emailError;

    return jsonResponse({ success: true }, 200);
  } catch (error) {
    console.error("Schedule endpoint error:", safeErrorMessage(error));
    return jsonResponse({ error: "Erro interno." }, 500);
  }
}

function normalizeContactFields(payload) {
  const fields = normalizeStringFields(payload, CONTACT_FIELD_LIMITS);
  if (!fields) return null;

  if (
    !isValidName(fields.nome) ||
    !isValidEmail(fields.email) ||
    !isValidBrazilianPhone(fields.telefone) ||
    !VALID_UFS.has(fields.estado) ||
    !fields.cidade ||
    fields.mensagem.length < 3 ||
    fields.website
  ) {
    return null;
  }

  return fields;
}

function normalizeDistributorFields(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (!Array.isArray(payload.tipo) || payload.tipo.length === 0) return null;

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

  const normalized = normalizeStringFields(payload, DISTRIBUTOR_FIELD_LIMITS);
  if (!normalized) return null;
  const fields = { tipo, ...normalized };

  if (
    !isValidName(fields.nome) ||
    !isValidBrazilianPhone(fields.contato) ||
    !VALID_UFS.has(fields.uf) ||
    !fields.cidade ||
    !DISTRIBUTOR_FOCUS_OPTIONS.has(fields.foco) ||
    fields.bot_field ||
    (fields.cnpj && !isValidCnpj(fields.cnpj))
  ) {
    return null;
  }

  const currentYear = new Date().getUTCFullYear();
  for (let index = 1; index <= 5; index += 1) {
    const year = fields[`ano${index}`];
    if (year && (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > currentYear)) {
      return null;
    }

    const state = fields[`uf_cid${index}`];
    const city = fields[`cid${index}`];
    const pairRequired = index === 1;
    if ((pairRequired || city) && !VALID_UFS.has(state)) return null;
    if ((pairRequired || state) && !city) return null;
  }

  return fields;
}

function normalizeScheduleFields(payload) {
  const fields = normalizeStringFields(payload, SCHEDULE_FIELD_LIMITS);
  if (!fields) return null;

  if (
    !isValidName(fields.nome) ||
    !isValidBrazilianPhone(fields.whatsapp) ||
    fields.instituicao.length < 2 ||
    (fields.telefone && !isValidBrazilianPhone(fields.telefone)) ||
    !VALID_UFS.has(fields.estado) ||
    !fields.cidade ||
    fields.homepage
  ) {
    return null;
  }

  return fields;
}

function normalizeStringFields(payload, limits) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;

  const fields = {};
  for (const [name, limit] of Object.entries(limits)) {
    const value = payload[name];
    if (value !== undefined && typeof value !== "string") return null;
    fields[name] = String(value || "").trim();
    if (fields[name].length > limit) return null;
  }
  return fields;
}

function isValidName(value) {
  const compact = value.replace(/\s/g, "");
  return value.length >= 2 && compact.length >= 2 && !/^\d+$/.test(compact);
}

function isValidEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidBrazilianPhone(value) {
  return /^\d{10,11}$/.test(value.replace(/\D/g, ""));
}

function isValidCnpj(value) {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (length) => {
    let factor = length - 7;
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * factor;
      factor -= 1;
      if (factor < 2) factor = 9;
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(digits[12]) &&
    calculateDigit(13) === Number(digits[13]);
}

async function sendResendEmail(env, payload, context) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !env.RESEND_TO_EMAIL) {
    console.error(`${context} configuration error: missing Resend environment variables.`);
    return jsonResponse({ error: "Erro interno." }, 500);
  }

  let resendResponse;
  try {
    resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("Resend request error:", safeErrorMessage(error));
    return jsonResponse({ error: "Erro ao enviar e-mail." }, 500);
  }

  const resendData = await readJsonSafely(resendResponse);
  if (!resendResponse.ok) {
    console.error("Resend error:", { status: resendResponse.status, data: resendData });
    return jsonResponse({ error: "Erro ao enviar e-mail." }, 500);
  }

  return null;
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

function optional(value) {
  return escapeHtml(value || "Não informado");
}

function buildContactEmailHtml(fields) {
  return `
    <h1>Novo contato pelo site</h1>
    <p><strong>Nome:</strong> ${escapeHtml(fields.nome)}</p>
    <p><strong>E-mail:</strong> ${escapeHtml(fields.email)}</p>
    <p><strong>Telefone:</strong> ${escapeHtml(fields.telefone)}</p>
    <p><strong>Estado:</strong> ${escapeHtml(fields.estado)}</p>
    <p><strong>Cidade:</strong> ${escapeHtml(fields.cidade)}</p>
    <p><strong>Instituição:</strong> ${optional(fields.instituicao)}</p>
    <p><strong>Mensagem:</strong></p>
    <p>${escapeHtml(fields.mensagem).replaceAll("\n", "<br>")}</p>
  `;
}

function buildScheduleEmailHtml(fields) {
  return `
    <h1>Nova solicitação de cronograma</h1>
    <p><strong>Nome:</strong> ${escapeHtml(fields.nome)}</p>
    <p><strong>Cargo:</strong> ${optional(fields.cargo)}</p>
    <p><strong>WhatsApp:</strong> ${escapeHtml(fields.whatsapp)}</p>
    <p><strong>Instituição:</strong> ${escapeHtml(fields.instituicao)}</p>
    <p><strong>Telefone da instituição:</strong> ${optional(fields.telefone)}</p>
    <p><strong>Estado:</strong> ${escapeHtml(fields.estado)}</p>
    <p><strong>Cidade:</strong> ${escapeHtml(fields.cidade)}</p>
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

  const rows = [`<p><strong>Tipo:</strong> ${fields.tipo.map(escapeHtml).join(", ")}</p>`];
  for (const [name, label] of Object.entries(labels)) {
    if (fields[name]) {
      rows.push(`<p><strong>${label}:</strong> ${escapeHtml(fields[name]).replaceAll("\n", "<br>")}</p>`);
    }
  }
  return `<h1>Nova solicitação de distribuidor</h1>${rows.join("")}`;
}

async function readLimitedJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return { response: jsonResponse({ error: "Requisição muito grande." }, 413) };
  }

  let rawBody;
  try {
    rawBody = await request.text();
  } catch {
    return { response: jsonResponse({ error: "JSON inválido." }, 400) };
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return { response: jsonResponse({ error: "Requisição muito grande." }, 413) };
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

function invalidFieldsResponse() {
  return jsonResponse({ error: "Preencha os campos obrigatórios." }, 400);
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function jsonResponse(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders }
  });
}
