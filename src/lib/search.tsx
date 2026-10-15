import React from 'react';
import { WithdrawalCase } from '../types';

export function searchCases(cases: WithdrawalCase[], query: string, exact: boolean = false): WithdrawalCase[] {
  if (!query) return cases;
  
  const lowerQuery = query.toLowerCase().trim();
  
  return cases.filter(c => {
    const fieldsToSearch = [
      c.case_id,
      c.username,
      c.user_password,
      c.platform,
      c.phone_number,
      c.payment_method,
      c.status,
      c.amount.toString()
    ];

    if (exact) {
      return fieldsToSearch.some(field => field?.toLowerCase() === lowerQuery);
    } else {
      return fieldsToSearch.some(field => field?.toLowerCase().includes(lowerQuery));
    }
  });
}

export function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  
  const parts = text.split(new RegExp(`(${query})`, 'gi'));
  return (
    <span>
      {parts.map((part, i) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-blue-500/30 text-blue-200 rounded px-0.5">{part}</mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}
