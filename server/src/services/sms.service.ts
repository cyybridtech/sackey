import dotenv from 'dotenv';
dotenv.config();

export interface SmsSendResult {
  success: boolean;
  error?: string;
  providerResponse?: any;
}

/**
 * Format local Ghanaian phone numbers to international standard (233XXXXXXXXX).
 * Example:
 *  0241234567 -> 233241234567
 *  +233241234567 -> 233241234567
 *  233241234567 -> 233241234567
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  // Remove spaces, hyphens, plus signs, brackets
  let cleaned = phone.replace(/[^\d+]/g, '').trim();

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // If local Ghanaian 10-digit number starting with 0 (e.g. 0244123456)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '233' + cleaned.substring(1);
  }

  return cleaned;
};

/**
 * Send an SMS via Vynfy SMS Gateway.
 */
export const sendSms = async (
  phone: string,
  message: string
): Promise<SmsSendResult> => {
  const apiKey = process.env.VYNFY_API_KEY || 'ffc6f3cebdc352541da86d0b6af5a3d7';
  const senderId = process.env.VYNFY_SENDER_ID || 'B.A. Ent';
  const apiUrl = process.env.VYNFY_API_URL || 'https://sms.vynfy.com/api/v1/send';

  const formattedPhone = formatPhoneNumber(phone);

  if (!formattedPhone) {
    const err = `Invalid recipient phone number: "${phone}"`;
    console.error(`[SMS Gateway] Error: ${err}`);
    return { success: false, error: err };
  }

  console.log(`[SMS Gateway] Attempting send to ${formattedPhone} using Sender ID "${senderId}"...`);

  try {
    const payload = {
      sender: senderId,
      sender_id: senderId,
      recipients: [formattedPhone],
      message,
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => null);

    if (!response.ok || data?.success === false) {
      const errMsg =
        data?.message ||
        data?.error ||
        data?.data?.message ||
        `Vynfy API returned status ${response.status} (${response.statusText})`;
      console.error(`[Vynfy SMS] Failed: ${errMsg}`);
      return {
        success: false,
        error: errMsg,
        providerResponse: data,
      };
    }

    console.log(`[Vynfy SMS] Success! Provider response:`, data);
    return {
      success: true,
      providerResponse: data,
    };
  } catch (err: any) {
    const errorMsg = err?.message || 'Network error communicating with Vynfy SMS API';
    console.error(`[Vynfy SMS] Exception:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
};
