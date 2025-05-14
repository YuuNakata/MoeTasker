// pages/api/cron/dailyReminder.js
import { triggerDailyReminders } from '@/lib/utils/schedulerHelpers'; // Ajusta la ruta

export default async function handler(req, res) {
  if (req.method === 'GET') { // Vercel Cron usa GET
    try {
      await triggerDailyReminders();
      res.status(200).send('Daily reminder job executed successfully.');
    } catch (error) {
      console.error('Cron job dailyReminder error:', error);
      res.status(500).send('Error executing daily reminder job.');
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).send('Method Not Allowed');
  }
}