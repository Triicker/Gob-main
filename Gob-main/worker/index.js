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
  mensagem: 4_000
};

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

    return env.ASSETS.fetch(request);
  }
};

async function handleContact(request, env) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Requisição muito grande." }, 413);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }

    const fields = normalizeFields(payload);
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

  if (!fields.nome || !fields.email || !fields.mensagem) {
    return null;
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
