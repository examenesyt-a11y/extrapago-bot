const { Telegraf } = require('telegraf');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

// Configuración directa extraída de tu aplicación web[span_2](start_span)[span_2](end_span)
const firebaseConfig = {
    apiKey: "AIzaSyBzx6jjpTW9OGQr9XvVOyI6PDyJzFsWTEo",
    authDomain: "extrapago-app.firebaseapp.com",
    projectId: "extrapago-app",
    storageBucket: "extrapago-app.firebasestorage.app",
    messagingSenderId: "507272401022",
    appId: "1:507272401022:web:0f3bf529de05d53f0ac82f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Pega aquí el token que te dio BotFather en Telegram
const BOT_TOKEN = process.env.BOT_TOKEN || 'TU_TOKEN_DE_TELEGRAM_AQUI';
const ADMIN_CHAT_ID = '8372996446';

const bot = new Telegraf(BOT_TOKEN);

// 1. Comando /estado
bot.command('estado', async (ctx) => {
    try {
        const snapshot = await db.collection('clients').get();
        let totalCartera = 0;
        let totalCapital = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            totalCartera += (data.currentBalance || 0);
            totalCapital += (data.baseAmount || 0);
        });

        const ganancia = totalCartera - totalCapital;

        ctx.reply(
            `📊 *Estado Actual - Extrapago*\n\n` +
            `💰 *Dinero en la Calle:* $${totalCartera.toLocaleString()}\n` +
            `📥 *Capital Invertido:* $${totalCapital.toLocaleString()}\n` +
            `📈 *Ganancias (Intereses):* $${ganancia.toLocaleString()}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Hubo un error al consultar la base de datos.');
    }
});

// 2. Comando /retirar [monto]
bot.command('retirar', async (ctx) => {
    const text = ctx.message.text;
    const args = text.split(' ');
    const monto = parseFloat(args[1]);

    if (!monto || isNaN(monto)) {
        return ctx.reply('⚠️ Por favor indica el monto a retirar. Ejemplo: `/retirar 50000`', { parse_mode: 'Markdown' });
    }

    try {
        await db.collection('withdrawals').add({
            amount: monto,
            date: new Date().toISOString(),
            type: 'retiro_caja'
        });

        ctx.reply(
            `✅ *Retiro registrado con éxito*\n\n` +
            `💵 Monto retirado: *$${monto.toLocaleString()}*\n` +
            `📅 Fecha: ${new Date().toLocaleString()}`,
            { parse_mode: 'Markdown' }
        );
    } catch (error) {
        console.error(error);
        ctx.reply('❌ Error al guardar el retiro en la base de datos.');
    }
});

// 3. Vigilar en tiempo real los nuevos abonos en Firebase para avisarte al Telegram[span_3](start_span)[span_3](end_span)
db.collection('payments').onSnapshot(async (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
            const payment = change.doc.data();
            
            try {
                const clientDoc = await db.collection('clients').doc(payment.clientId).get();
                if (clientDoc.exists) {
                    const client = clientDoc.data();
                    
                    const mensaje = `📲 *¡Nuevo Abono Registrado!*\n\n` +
                                    `👤 *Cliente:* ${client.name} ${client.lastName}\n` +
                                    `💵 *Abono:* $${payment.amount.toLocaleString()}\n` +
                                    `📉 *Saldo Restante:* $${client.currentBalance.toLocaleString()}\n` +
                                    `🏷️ *Valor Cuota:* $${client.quotaValue.toLocaleString()}`;

                    await bot.telegram.sendMessage(ADMIN_CHAT_ID, mensaje, { parse_mode: 'Markdown' });
                }
            } catch (err) {
                console.error('Error enviando notificación de pago en tiempo real:', err);
            }
        }
    });
});

bot.launch();
console.log('🤖 Bot de Extrapago iniciado y escuchando Firebase...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
