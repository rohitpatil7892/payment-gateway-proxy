import { v4 as uuidv4 } from 'uuid';

export const generateTransactionId = (): string => {
  return `txn_${uuidv4()}`;
};

export const generateAssessmentId = (): string => {
  return `risk_${uuidv4()}`;
};

export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.replace(/^(txn_|risk_)/, ''));
};
