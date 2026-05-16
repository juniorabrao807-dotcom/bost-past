const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fetch = require('node-fetch');

// ============================================================
//  BT JRBN - Bot de Vendas de Megas Vodacom
// ============================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_KEY;
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/nix/store/chromium/bin/chromium';

const TABELA_MEGAS = `
╔══════════════════════════════════════════╗
║         📶 TABELA DE PACOTES BT JRBN     ║
║              Vodacom Moçambique           ║
╠══════════════════════════════════════════╣
║  📱 PACOTES DIÁRIOS                      ║
║  📦 400 MB    →   10,00 MT               ║
║  📦 800 MB    →   20,00 MT               ║
║  📦 1.024 MB  →   26,00 MT               ║
║  📦 1.126 MB  →   28,00 MT               ║
║  📦 2.252 MB  →   56,00 MT               ║
║  📦 3.072 MB  →   78,00 MT               ║
║  📦 4.048 MB  →  100,00 MT               ║
╠══════════════════════════════════════════╣
║  📅 PACOTES SEMANAIS                     ║
║  📦 3.500 MB  →   96,00 MT               ║
║  📦 5.325 MB  →  140,00 MT               ║
║  📦 7.270 MB  →  185,00 MT               ║
║  📦 9.010 MB  →  240,00 MT               ║
╠══════════════════════════════════════════╣
║  🗓️ PACOTES MENSAIS                      ║
║  📦 10.240 MB →  279,00 MT               ║
║  📦 13.572 MB →  370,00 MT               ║
║  📦 18.299 MB →  460,00 MT               ║
║  📦 25.459 MB →  650,00 MT               ║
║  📦 36.631 MB →  895,00 MT               ║
║  📦 54.886 MB → 1.450,00 MT              ║
╠══════════════════════════════════════════╣
║  🌍 MENSAIS + SMS Ilimitadas             ║
║     + 10min Internacional + 30MB Roam    ║
║  📦 10.240 MB →  445,00 MT               ║
║  📦 13.572 MB →  550,00 MT               ║
║  📦 18.572 MB →  550,00 MT               ║
║  📦 25.459 MB →  800,00 MT               ║
║  📦 36.631 MB → 1.165,00 MT              ║
║  📦 54.886 MB → 1.450,00 MT              ║
╠══════════════════════════════════════════╣
║  ⚠️ NOTA: Pacotes Mensais e Semanais     ║
║  não podem ter Txuna Crédito activo.     ║
╠══════════════════════════════════════════╣
║  💳 PAGAMENTO:                           ║
║  M-Pesa:  849192098 — Neivaldo Abrão     ║
║  E-Mola:  870099779 — Monteiro Abrão     ║
╚══════════════════════════════════════════╝
`;

const SYSTEM_PROMPT = `Você é o assistente virtual da BT JRBN, uma empresa de revenda de pacotes de dados (megabytes) da Vodacom em Moçambique.

O seu nome é BT JRBN e deve se comunicar de forma FORMAL e profissional, sempre em Português.

TABELA DE PREÇOS:
${TABELA_MEGAS}

FORMAS DE PAGAMENTO:
- M-Pesa: transferir para o número 849192098 (nome: Neivaldo Abrão)
- E-Mola: transferir para o número 870099779 (nome: Monteiro Abrão)
- Após o pagamento, o cliente deve enviar o comprovativo por aqui

NOTA IMPORTANTE SOBRE PACOTES:
- Pacotes Mensais e Semanais NÃO podem ser activados se o cliente tiver Txuna Crédito activo
- Informar o cliente sobre esta condição antes de confirmar a compra

PROCESSO DE COMPRA:
1. Cliente escolhe o pacote
2. Cliente faz o pagamento via M-Pesa ou e-Mola
3. Cliente envia comprovativo
4. BT JRBN activa o pacote em até 5 minutos

REGRAS IMPORTANTES:
- Seja sempre formal e educado
- Se o cliente perguntar sobre a tabela de preços, envie a tabela completa
- Se o cliente quiser comprar, peça o número Vodacom para activar
- Se o cliente enviar comprovativo, diga que irá verificar e activar em breve
- Nunca prometa prazos que não pode cumprir
- Se não souber responder, diga que irá encaminhar ao responsável

Responda de forma concisa e profissional. Máximo 3-4 frases por resposta.`;

const conversas = {};

async function perguntarIA(numeroTelefone, mensagemCliente) {
  if (!conversas[numeroTelefone]) conversas[numeroTelefone] = [];

  conversas[numeroTelefone].push({ role: 'user', content: mensagemCliente });

  if (conversas[numeroTelefone].length > 10) {
    conversas[numeroTelefone] = conversas[numeroTelefone].slice(-10);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: conversas[numeroTelefone]
      })
    });

    const data = await response.json();
    const respostaBot = data.content[0].text;
    conversas[numeroTelefone].push({ role: 'assistant', content: respostaBot });
    return respostaBot;
  } catch (erro) {
    console.error('Erro na API:', erro);
    return 'Pedimos desculpa, ocorreu um erro técnico. Por favor, tente novamente em alguns instantes.';
  }
}

// Encontrar o caminho do Chromium automaticamente
const { execSync } = require('child_process');
let chromiumPath = '';
try {
  chromiumPath = execSync('which chromium || which chromium-browser || which google-chrome').toString().trim();
  console.log('✅ Chromium encontrado em:', chromiumPath);
} catch (e) {
  console.log('⚠️ Chromium não encontrado no PATH, usando caminho padrão...');
  chromiumPath = '/nix/store/chromium/bin/chromium';
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ],
  }
});

client.on('qr', (qr) => {
  console.log('\n========================================');
  console.log('📱 SCAN O QR CODE ABAIXO COM O WHATSAPP');
  console.log('========================================\n');
  qrcode.generate(qr, { small: true });
  console.log('\n👆 WhatsApp → Configurações → Dispositivos Ligados → Ligar Dispositivo\n');
});

client.on('ready', () => {
  console.log('✅ BT JRBN Bot conectado com sucesso!');
});

client.on('disconnected', (reason) => {
  console.log('❌ Bot desconectado:', reason);
  setTimeout(() => client.initialize(), 5000);
});

client.on('message', async (msg) => {
  if (msg.fromMe) return;
  if (msg.from.includes('@g.us')) return;
  if (!msg.body) return;

  console.log(`📩 Mensagem de ${msg.from}: ${msg.body}`);
  const resposta = await perguntarIA(msg.from, msg.body);
  await msg.reply(resposta);
  console.log(`📤 Resposta enviada: ${resposta}`);
});

client.initialize();
