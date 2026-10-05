const assert = require("node:assert/strict");
const { readFile } = require("node:fs/promises");
const { test } = require("node:test");
const vm = require("node:vm");

const workerSourcePath = require("node:path").resolve(
  __dirname,
  "../worker/index.js"
);

async function loadWorker(fetchImplementation) {
  const source = await readFile(workerSourcePath, "utf8");
  const context = vm.createContext({
    console,
    fetch: fetchImplementation,
    Headers,
    Request,
    Response,
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

function environment(overrides = {}) {
  return {
    ASSETS: { fetch: async () => new Response("asset") },
    RESEND_API_KEY: "test-key",
    RESEND_FROM_EMAIL: "Instituto BASTA <contato@example.com>",
    RESEND_TO_EMAIL: "destino@example.com",
    ...overrides
  };
}

test("envia o contato válido pelo Resend e escapa HTML", async () => {
  let resendRequest;
  const worker = await loadWorker(async (url, options) => {
    resendRequest = { url, options };
    return Response.json({ id: "email-id" });
  });

  const response = await worker.fetch(
    contactRequest({
      nome: "Ana <script>",
      telefone: "(11) 99999-9999",
      email: "ana@example.com",
      instituicao: "Escola & Comunidade",
      cidade: "Salvador/BA",
      mensagem: "Olá <b>mundo</b>"
    }),
    environment()
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal(resendRequest.url, "https://api.resend.com/emails");
  assert.equal(resendRequest.options.headers.Authorization, "Bearer test-key");

  const email = JSON.parse(resendRequest.options.body);
  assert.equal(email.reply_to, "ana@example.com");
  assert.match(email.html, /Ana &lt;script&gt;/);
  assert.match(email.html, /Escola &amp; Comunidade/);
  assert.match(email.html, /Olá &lt;b&gt;mundo&lt;\/b&gt;/);
  assert.doesNotMatch(email.html, /<script>|<b>mundo<\/b>/);
});

test("rejeita campos obrigatórios ausentes", async () => {
  const worker = await loadWorker(async () => {
    throw new Error("Resend não deveria ser chamado.");
  });

  for (const body of [
    { email: "ana@example.com", mensagem: "Olá" },
    { nome: "Ana", mensagem: "Olá" },
    { nome: "Ana", email: "ana@example.com" }
  ]) {
    const response = await worker.fetch(contactRequest(body), environment());
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Preencha os campos obrigatórios."
    });
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
    contactRequest({
      nome: "Ana",
      email: "ana@example.com",
      mensagem: "Olá"
    }),
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
