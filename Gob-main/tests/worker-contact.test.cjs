const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { test } = require("node:test");
const vm = require("node:vm");

const workerSourcePath = require("node:path").resolve(
  __dirname,
  "../worker/index.js"
);
const wranglerConfigPath = require("node:path").resolve(
  __dirname,
  "../wrangler.jsonc"
);

async function loadWorker(fetchImplementation) {
  const source = await readFile(workerSourcePath, "utf8");
  const context = vm.createContext({
    console,
    fetch: fetchImplementation,
    Headers,
    Request,
    Response,
    TextEncoder,
    URL
  });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(() => {
    throw new Error("O Worker não deve importar módulos externos.");
  });
  await module.evaluate();
  return module.namespace.default;
}

function contactRequest(body, method = "POST") {
  return new Request("https://example.com/api/contact", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

function distributorRequest(body, method = "POST") {
  return new Request("https://example.com/api/distributor", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

function scheduleRequest(body, method = "POST") {
  return new Request("https://example.com/api/schedule", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });
}

function validContact(overrides = {}) {
  return {
    nome: "Ana Souza",
    telefone: "(71) 99999-9999",
    email: "ana@example.com",
    estado: "BA",
    cidade: "Salvador",
    instituicao: "Escola Comunidade",
    mensagem: "Olá, mundo!",
    website: "",
    ...overrides
  };
}

function validDistributor(overrides = {}) {
  return {
    tipo: ["Distribuidor", "Formador"],
    nome: "Ana Souza",
    contato: "(71) 99999-9999",
    cidade: "Salvador",
    uf: "BA",
    empresa: "Educação Brasil",
    cnpj: "04.252.011/0001-10",
    foco: "Rede pública",
    uf_cid1: "BA",
    cid1: "Salvador",
    mensagem: "Tenho interesse na parceria.",
    bot_field: "",
    ...overrides
  };
}

function validSchedule(overrides = {}) {
  return {
    nome: "Ana Souza",
    cargo: "Diretora",
    whatsapp: "(71) 99999-9999",
    instituicao: "Escola Comunidade",
    telefone: "(71) 3333-4444",
    estado: "BA",
    cidade: "Salvador",
    homepage: "",
    ...overrides
  };
}

function environment(overrides = {}) {
  return {
    ASSETS: { fetch: async () => new Response("asset") },
    RESEND_API_KEY: "test-key",
    RESEND_FROM_EMAIL: "Instituto BASTA <contato@example.com>",
    RESEND_TO_EMAIL: "destino@example.com",
    ...overrides
  };
}

test("configura remetente de produção no domínio verificado", async () => {
  const config = JSON.parse(await readFile(wranglerConfigPath, "utf8"));
  assert.match(config.vars.RESEND_FROM_EMAIL, /@basta\.app\.br>/);
  assert.doesNotMatch(config.vars.RESEND_FROM_EMAIL, /@resend\.dev/);
});

test("envia o contato válido pelo Resend", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "email-id" });
  });

  const response = await worker.fetch(
    contactRequest(validContact()),
    environment()
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(resendRequest.url, "https://api.resend.com/emails");
  assert.equal(resendRequest.options.headers.Authorization, "Bearer test-key");

  const email = JSON.parse(resendRequest.options.body);
  assert.equal(email.reply_to, "ana@example.com");
  assert.match(email.html, /Ana Souza/);
  assert.match(email.html, /Escola Comunidade/);
});

test("escapa HTML malicioso nos campos de contato", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "email-id" });
  });

  const response = await worker.fetch(
    contactRequest(validContact({
      nome: "Ana <script>alert(1)</script>",
      instituicao: "Escola & <b>Comunidade</b>",
      mensagem: "Olá <img src=x onerror=alert(1)>"
    })),
    environment()
  );

  assert.equal(response.status, 200);
  const email = JSON.parse(resendRequest.options.body);
  assert.match(email.html, /Ana &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.html, /Escola &amp; &lt;b&gt;Comunidade&lt;\/b&gt;/);
  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(email.html, /<script>|<b>|<img/);
});

test("rejeita campos obrigatórios ausentes", async () => {
  const worker = await loadWorker(async () => {
    throw new Error("Resend não deveria ser chamado.");
  });

  for (const body of [
    { telefone: "(71) 99999-9999", email: "ana@example.com", mensagem: "Olá" },
    { nome: "Ana", email: "ana@example.com", mensagem: "Olá" },
    { nome: "Ana", telefone: "(71) 99999-9999", mensagem: "Olá" },
    { nome: "Ana", telefone: "(71) 99999-9999", email: "ana@example.com" },
    {
      nome: "Ana",
      telefone: "(71) 99999-9999",
      email: "ana@example.com",
      mensagem: "Olá",
      website: "spam.example"
    }
  ]) {
    const response = await worker.fetch(contactRequest(body), environment());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Preencha os campos obrigatórios."
    });
  }
});

test("rejeita validações inválidas do contato sem chamar o Resend", async () => {
  const worker = await loadWorker(async () => {
    throw new Error("Resend não deveria ser chamado.");
  });

  for (const body of [
    validContact({ nome: "123456" }),
    validContact({ email: "email-invalido" }),
    validContact({ telefone: "(71) 1234" }),
    validContact({ estado: "XX" }),
    validContact({ cidade: "" }),
    validContact({ mensagem: "Oi" })
  ]) {
    const response = await worker.fetch(contactRequest(body), environment());
    assert.equal(response.status, 400);
  }
});

test("retorna 405 para método diferente de POST", async () => {
  const worker = await loadWorker(async () => new Response());
  const response = await worker.fetch(
    contactRequest({}, "GET"),
    environment()
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("não expõe o erro retornado pelo Resend", async () => {
  const worker = await loadWorker(async () =>
    Response.json({ message: "provider details" }, { status: 422 })
  );
  const response = await worker.fetch(
    contactRequest(validContact({ nome: "Ana" })),
    environment()
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Erro ao enviar e-mail." });
});

test("delega rotas públicas ao binding de assets", async () => {
  let delegatedRequest;
  const worker = await loadWorker(async () => new Response());
  const env = environment({
    ASSETS: {
      fetch: async (request) => {
        delegatedRequest = request;
        return new Response("asset-ok", { status: 200 });
      }
    }
  });

  const response = await worker.fetch(
    new Request("https://example.com/css/base.css"),
    env
  );

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset-ok");
  assert.equal(new URL(delegatedRequest.url).pathname, "/css/base.css");
});

test("envia distribuidor válido e preserva o array de tipos", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "email-id" });
  });

  const response = await worker.fetch(
    distributorRequest(validDistributor()),
    environment()
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(resendRequest.url, "https://api.resend.com/emails");

  const email = JSON.parse(resendRequest.options.body);
  assert.equal(email.subject, "Nova solicitação de distribuidor - Ana Souza");
  assert.match(email.html, /Distribuidor, Formador/);
  assert.match(email.html, /Educação Brasil/);
});

test("retorna 405 para GET no endpoint de distribuidor", async () => {
  const worker = await loadWorker(async () => new Response());
  const response = await worker.fetch(
    distributorRequest({}, "GET"),
    environment()
  );

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.deepEqual(await response.json(), { error: "Método não permitido." });
});

test("rejeita payload inválido de distribuidor", async () => {
  const worker = await loadWorker(async () => {
    throw new Error("Resend não deveria ser chamado.");
  });

  for (const body of [
    validDistributor({ tipo: [] }),
    validDistributor({ nome: "" }),
    validDistributor({ foco: "Outro" }),
    validDistributor({ uf: "Bahia" }),
    validDistributor({ contato: "123" }),
    validDistributor({ cnpj: "12.345.678/0001-90" }),
    validDistributor({ ano1: "1899" }),
    validDistributor({ ano1: String(new Date().getUTCFullYear() + 1) }),
    validDistributor({ uf_cid1: "", cid1: "" }),
    validDistributor({ uf_cid2: "SP", cid2: "" }),
    validDistributor({ uf_cid2: "", cid2: "Campinas" })
  ]) {
    const response = await worker.fetch(distributorRequest(body), environment());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Preencha os campos obrigatórios."
    });
  }
});

test("não expõe o erro do Resend no endpoint de distribuidor", async () => {
  const worker = await loadWorker(async () =>
    Response.json({ message: "provider distributor details" }, { status: 422 })
  );
  const response = await worker.fetch(
    distributorRequest(validDistributor()),
    environment()
  );

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "Erro ao enviar e-mail." });
});

test("escapa HTML malicioso nos campos de distribuidor", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "email-id" });
  });

  const response = await worker.fetch(
    distributorRequest(validDistributor({
      nome: "Ana <script>alert(1)</script>",
      empresa: "Escola & <b>Parceiros</b>",
      mensagem: "Olá <img src=x onerror=alert(1)>"
    })),
    environment()
  );

  assert.equal(response.status, 200);
  const email = JSON.parse(resendRequest.options.body);
  assert.match(email.html, /Ana &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.html, /Escola &amp; &lt;b&gt;Parceiros&lt;\/b&gt;/);
  assert.match(email.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(email.html, /<script>|<b>|<img/);
});

test("aceita CNPJ válido, ano válido e pares opcionais completos", async () => {
  const worker = await loadWorker(async () => Response.json({ id: "email-id" }));
  const response = await worker.fetch(
    distributorRequest(validDistributor({
      cnpj: "04.252.011/0001-10",
      ano1: "2024",
      uf_cid2: "SP",
      cid2: "Campinas"
    })),
    environment()
  );

  assert.equal(response.status, 200);
});

test("envia solicitação de cronograma pelo Resend com todos os campos", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "schedule-email-id" });
  });

  const response = await worker.fetch(scheduleRequest(validSchedule()), environment());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(resendRequest.url, "https://api.resend.com/emails");

  const email = JSON.parse(resendRequest.options.body);
  assert.equal(email.subject, "Nova solicitação de cronograma - Ana Souza");
  assert.equal(email.from, environment().RESEND_FROM_EMAIL);
  assert.deepEqual(email.to, [environment().RESEND_TO_EMAIL]);
  for (const value of ["Ana Souza", "Diretora", "99999-9999", "Escola Comunidade", "3333-4444", "BA", "Salvador"]) {
    assert.match(email.html, new RegExp(value));
  }
});

test("rejeita campos inválidos e honeypot do cronograma", async () => {
  const worker = await loadWorker(async () => {
    throw new Error("Resend não deveria ser chamado.");
  });

  for (const body of [
    validSchedule({ nome: "" }),
    validSchedule({ nome: "1234" }),
    validSchedule({ whatsapp: "123" }),
    validSchedule({ instituicao: "A" }),
    validSchedule({ telefone: "123" }),
    validSchedule({ estado: "XX" }),
    validSchedule({ cidade: "" }),
    validSchedule({ homepage: "spam.example" })
  ]) {
    const response = await worker.fetch(scheduleRequest(body), environment());
    assert.equal(response.status, 400);
  }
});

test("retorna 405 para GET no endpoint de cronograma", async () => {
  const worker = await loadWorker(async () => new Response());
  const response = await worker.fetch(scheduleRequest({}, "GET"), environment());
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("escapa HTML malicioso no e-mail do cronograma", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "email-id" });
  });
  const response = await worker.fetch(
    scheduleRequest(validSchedule({
      nome: "Ana <script>alert(1)</script>",
      cargo: "Diretora & <b>Gestora</b>"
    })),
    environment()
  );

  assert.equal(response.status, 200);
  const email = JSON.parse(resendRequest.options.body);
  assert.match(email.html, /Ana &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(email.html, /Diretora &amp; &lt;b&gt;Gestora&lt;\/b&gt;/);
  assert.doesNotMatch(email.html, /<script>|<b>/);
});
