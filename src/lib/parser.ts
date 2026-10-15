import { WithdrawalCase, StatusLog } from '../types';

export function parseRawWithdrawalText(text: string): Partial<WithdrawalCase> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  const result: any = {
    status_logs: [] as StatusLog[],
  };

  // 1. Extract Timeline (Message + Timestamp pairs)
  // Pattern: Message line followed by YYYY-MM-DD HH:MM:SS line
  const timestampRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
  for (let i = 0; i < lines.length - 1; i++) {
    if (timestampRegex.test(lines[i + 1]) && !lines[i].includes(':')) {
      // Check if it's a message + timestamp pair
      // We exclude lines with colons to avoid picking up "Type: Withdrawal" as a message
      result.status_logs.push({
        id: crypto.randomUUID(),
        message: lines[i],
        timestamp: lines[i + 1]
      });
      // Skip the timestamp line in the next iteration
      i++;
    }
  }

  // 2. Extract Structured Fields using RegEx or Key-Value detection
  const findValueAfter = (keys: string[]) => {
    const index = lines.findIndex(l => keys.some(k => l.toLowerCase() === k.toLowerCase()));
    return index !== -1 && index < lines.length - 1 ? lines[index + 1] : null;
  };

  result.case_id = findValueAfter(['No.', 'নং', 'Case ID']);
  result.type = findValueAfter(['Type', 'ধরণ']);
  result.payment_method = findValueAfter(['Payment method', 'পেমেন্ট মেথড'])?.toLowerCase();
  result.phone_number = findValueAfter(['Phone Number', 'ফোন নাম্বার']);
  if (result.phone_number) {
    result.phone_number = normalizePhoneNumber(result.phone_number);
  }
  result.withdrawal_speed = findValueAfter(['Withdrawal Speed', 'উইথড্রয়াল স্পিড']);
  
  const rawAmount = findValueAfter(['Amount', 'এমাউন্ট']);
  if (rawAmount) {
    // Convert Bengali numerals to English
    const bengaliToEnglish: { [key: string]: string } = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    let normalizedAmount = rawAmount;
    Object.keys(bengaliToEnglish).forEach(b => {
      normalizedAmount = normalizedAmount.replace(new RegExp(b, 'g'), bengaliToEnglish[b]);
    });

    // Convert "- 1,000.00" -> -1000.00
    const cleanAmount = normalizedAmount.replace(/[^0-9.-]/g, '');
    result.amount = parseFloat(cleanAmount);
  }

  // Platform, Username, Password usually appear at the end or in specific order
  // sumon047
  // SuMoN@12
  // jeetbuzz
  
  // Let's try to find them by looking at the last 3 lines if they aren't parsed yet
  // This is a bit heuristic but common in these logs
  const knownPlatforms = ['jeetbuzz', 'baji', 'mcw', 'cashex', 'velobet'];
  
  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase();
    if (knownPlatforms.includes(lowerLine)) {
      result.platform = lowerLine;
      // Usually username and password are the two lines before the platform
      if (idx >= 2) {
        result.username = lines[idx - 2];
        result.user_password = lines[idx - 1];
      }
    }
  });

  // Fallback for Case ID
  if (!result.case_id) {
    result.case_id = 'W' + Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  }

  return result;
}

export function normalizePhoneNumber(input: string): string {
    if (!input) return '';
    // Remove all non-digit characters
    let cleaned = input.replace(/\D/g, '');

    // If it starts with 880 (international code), remove it and add 0
    if (cleaned.startsWith('880')) {
        cleaned = '0' + cleaned.substring(3);
    }
    // If it's a 10-digit number starting with 1, prepend 0
    else if (cleaned.length === 10 && cleaned.startsWith('1')) {
        cleaned = '0' + cleaned;
    }
    
    return cleaned;
}
