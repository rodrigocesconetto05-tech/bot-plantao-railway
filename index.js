// index.js - bot WhatsApp plantão com whatsapp-web.js e Node.js

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const respondedMessages = new Map();

let ultimoQrCode = '';

const gruposMonitorados = [
    'Anotações Aulas',
    'A Turma da Bimbinha',
    'Meus Materiais'
];

const padroesNegar = [
    /pass(ei|ou|ando)?\s+(meu|o)?\s*(plant[aã]o)?\s*(do|da|das)?\s*\d{1,2}([h:-]\d{1,2})?\s*(para|pra|pro|com)\s+(@?\w+)/i,
    /pass(ei|ou|ando)?\s+(o|meu)?\s*plant[aã]o\s+(para|pra|pro|com)\s+@?\w+/i,
    /pass(ei|ou|ando)?\s+(na|no|em|a[ií]|l[\u00e1a])/i,
    /\bpegou\b.*(@?\w+)?/i,
    /plant[aã]o.*(ficou|vai|será|pego|pegou)/i,
    /\bficou com\b.*/i,
    /passado para\s+@?\w+/i,
    /\bficou (pra|pro)\b.*/i,
    /\bj[aá] (foi|peguei|pegaram|passaram|vai|vai fazer|vai cobrir)\b/i,
    /algu[eé]m (pegou|vai fazer|ficou com)/i,
    /\bdivid[ií] com\b.*/i,
    /n[oã]o vou poder.*/i,
    /vai fazer o meu.*(plant[aã]o)?/i,
    /@\w+ (vai fazer|ficou|pegou|assumiu)/i,
    /pass(ei|ou|ando)?\s*(plant[aã]o)?\s*(do|dia)?\s*\d{1,2}(\s+)?(para|pra|pro|com)\s+@?\w+/i,
    /pass(ei|ou|ando)?\s+(das|da|do)?\s*\d{1,2}[-h:]\d{1,2}\s+(para|pra|pro|com)\s+(@?\w+)/i,
    /pass(ei|ou|ando)?\s*(dia|do dia)?\s*\d{1,2}/i
];

const padraoPego = new RegExp(
  [
    'pass(o|ando)?(\\s+(meu|o))?(\\s+plant[aã]o)?(\\s+(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno|\\d{1,2}[h:]\\d{2}))?',
    'algu[eé]m\\s+(pode|consegue|quer|topa|dispon[ié]vel|assume)?\\s*(fazer|pegar|cobrir|assumir|me cobrir|me substituir|fazer meu)\\s*((meu|o)?\\s*plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno|\\d{1,2}[h:]\\d{2})?',
    'algu[eé]m\\s+(dispon[ié]vel|pra|para)?\\s*(fazer|assumir|cobrir|substituir|me cobrir)\\s*(plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno)',
    'quem\\s+(pode|consegue|topa)\\s*(fazer|cobrir|pegar|assumir|substituir|me cobrir)\\s*(plant[aã]o)?\\s*(hoje|amanh[aã]|dia\\s+\\d{1,2}|noturno|diurno)'
  ].join('|'),
  'i'
);

const padraoReforco = /refor[cç]o|reforcar|algu[éé]m pode ajudar|precisa de ajuda|procura refor[cç]o|dividir plant[aã]o|algu[éé]m ajuda|precisa de refor[cç]o/i;

function deveResponder(msg) {
    const texto = msg.toLowerCase();

    const mencaoAlvo = /(para|pra|pro|com)\s+(@?\w+)/i;
    if (texto.includes('passo') && mencaoAlvo.test(texto)) {
        return false;
    }

    if (padraoReforco.test(texto)) {
        return 'Posso';
    }

    if (padraoPego.test(texto)) {
        for (const padrao of padroesNegar) {
            if (padrao.test(texto)) {
                return false;
            }
        }
        return 'Pego';
    }

    return false;
}

// ⬇️ Ajustado para usar o Chromium baixado
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: './chromium/mac_arm-1108766/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', (qr) => {
    ultimoQrCode = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr)}&size=250x250`;
    console.log('QR Code atualizado — escaneie via navegador!');
});

client.on('ready', () => {
    console.log('Cliente WhatsApp está pronto!');
});

client.on('message', async msg => {
    try {
        const chat = await msg.getChat();

        if (chat.isGroup && gruposMonitorados.includes(chat.name)) {
            const resposta = deveResponder(msg.body);

            const lastTime = respondedMessages.get(chat.id._serialized);
            const now = Date.now();
            const FIVE_HOURS = 5 * 60 * 60 * 1000;

            if (resposta && (!lastTime || now - lastTime > FIVE_HOURS)) {
                await chat.sendMessage(resposta);
                respondedMessages.set(chat.id._serialized, now);
                console.log(`Respondido no grupo "${chat.name}": "${resposta}" para mensagem: "${msg.body}"`);
            } else if (resposta) {
                console.log(`Ignorado por limite de tempo (5h) no grupo "${chat.name}".`);
            }
        }
    } catch (error) {
        console.error('Erro ao processar mensagem:', error);
    }
});

client.initialize();

app.get('/', (req, res) => {
    res.send(ultimoQrCode ? `<img src="${ultimoQrCode}" />` : 'Aguardando QR Code...');
});

app.listen(8080, () => {
    console.log('Servidor HTTP escutando na porta 8080');
});
