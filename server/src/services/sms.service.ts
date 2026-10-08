/**
 * SMS Service — Africa's Talking ready placeholder.
 * Logs SMS content to console. Replace body with actual API call in production.
 */
export const sendSms = async (phone: string, message: string): Promise<boolean> => {
  try {
    // TODO: Replace with Africa's Talking SDK call
    // const africastalking = require('africastalking')({ apiKey: ..., username: ... });
    // await africastalking.SMS.send({ to: [phone], message });
    console.log(`[SMS] → ${phone}: ${message}`);
    return true;
  } catch (err) {
    console.error('[SMS] Failed to send:', err);
    return false;
  }
};
