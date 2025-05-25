// pages/api/git_webhook.js
import { createHmac } from 'crypto';
import { sendMessage } from '@/utils/telegram';
import { escapeHTML, bold, italic, code, link } from '@/lib/utils/htmlEscaper';

// Es crucial que Next.js no parsee el cuerpo de la solicitud por nosotros,
// ya que necesitamos el cuerpo crudo (raw body) para verificar la firma de GitHub.
export const config = {
  api: {
    bodyParser: false,
  },
};

// Función para leer el stream del request y obtener el cuerpo crudo
async function getRawBody(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).send('Method Not Allowed');
  }

  const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
  const TELEGRAM_CHAT_ID = process.env.TARGET_GROUP_ID; // Chat ID a donde enviar notificaciones

  if (!GITHUB_WEBHOOK_SECRET) {
    console.error('git_webhook: GITHUB_WEBHOOK_SECRET no está configurado.');
    return res.status(500).send('Server configuration error: Missing webhook secret.');
  }
  if (!TELEGRAM_CHAT_ID) {
    console.error('git_webhook: TELEGRAM_TARGET_CHAT_ID no está configurado.');
    return res.status(500).send('Server configuration error: Missing target chat ID.');
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-hub-signature-256'];
    const githubEvent = req.headers['x-github-event'];

    if (!signature) {
      return res.status(401).send('No signature provided.');
    }

    const hmac = createHmac('sha256', GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

    if (digest !== signature) {
      console.warn('git_webhook: Invalid signature.');
      return res.status(401).send('Invalid signature.');
    }

    // Solo nos interesa el evento 'push'
    if (githubEvent !== 'push') {
      return res.status(200).send(`Event ${githubEvent} received, but not processed.`);
    }

    const payload = JSON.parse(rawBody.toString());

    const branch = payload.ref.replace('refs/heads/', '');
    const pusherName = payload.pusher ? payload.pusher.name : 'Alguien';
    const repoName = payload.repository ? payload.repository.name : 'el repositorio';
    const repoUrl = payload.repository ? payload.repository.html_url : '';

    if (payload.commits && payload.commits.length > 0) {
      let messageText = `${bold('¡Nuevos commits en el proyecto!')} ✨\n`;
      messageText += `Repo: ${link(escapeHTML(repoName), repoUrl)} | Rama: ${code(escapeHTML(branch))}\n`;
      messageText += `Pusheados por: ${bold(escapeHTML(pusherName))}\n\n`;

      for (const commit of payload.commits) {
        const commitAuthor = commit.author.name || commit.author.username || 'Desconocido';
        // Limitar longitud del mensaje de commit para evitar mensajes muy largos
        const commitMessage = commit.message.length > 100 ? commit.message.substring(0, 97) + '...' : commit.message;
        messageText += `📝 ${italic(escapeHTML(commitMessage))}\n`;
        messageText += `👤 Autor: ${escapeHTML(commitAuthor)}\n`;
        messageText += `🔗 ${link('Ver commit', commit.url)}\n---\n`;
      }

      try {
        await sendMessage(TELEGRAM_CHAT_ID, messageText.trim(), 'HTML');
        console.log(`git_webhook: Notificación de commit enviada a ${TELEGRAM_CHAT_ID}`);
      } catch (telegramError) {
        console.error('git_webhook: Error enviando mensaje a Telegram:', telegramError);
        // No devolvemos error a GitHub por esto, ya que el webhook fue procesado
      }
    }

    return res.status(200).send('Webhook processed successfully.');

  } catch (error) {
    console.error('git_webhook: Error procesando webhook:', error);
    return res.status(500).send('Internal Server Error');
  }
}
