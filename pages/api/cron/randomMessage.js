// pages/api/cron/randomMessage.js
import { triggerRandomFunMessage } from '@/lib/utils/schedulerHelpers'; // Ajusta la ruta

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      await triggerRandomFunMessage();
      res.status(200).send('Random message job executed successfully.');
    } catch (error) {
      console.error('Cron job randomMessage error:', error);
      res.status(500).send('Error executing random message job.');
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).send('Method Not Allowed');
  }
}