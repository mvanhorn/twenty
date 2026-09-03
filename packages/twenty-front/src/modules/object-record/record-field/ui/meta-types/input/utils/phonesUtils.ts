import { isArray } from '@sniptt/guards';

import {
  type FieldPhonesValue,
  type PhoneRecord,
} from '@/object-record/record-field/ui/types/FieldMetadata';
import { isDefined, parseJson } from 'twenty-shared/utils';

const normalizeAdditionalPhones = (
  additionalPhones: FieldPhonesValue['additionalPhones'] | string,
): PhoneRecord[] => {
  const parsedAdditionalPhones =
    typeof additionalPhones === 'string'
      ? parseJson<PhoneRecord[]>(additionalPhones)
      : additionalPhones;

  return isArray(parsedAdditionalPhones) ? parsedAdditionalPhones : [];
};

export const createPhonesFromFieldValue = (fieldValue: FieldPhonesValue) => {
  return !isDefined(fieldValue)
    ? []
    : [
        fieldValue.primaryPhoneNumber
          ? {
              number: fieldValue.primaryPhoneNumber,
              callingCode: fieldValue.primaryPhoneCallingCode
                ? fieldValue.primaryPhoneCallingCode
                : fieldValue.primaryPhoneCountryCode,
              countryCode: fieldValue.primaryPhoneCountryCode,
            }
          : null,
        ...normalizeAdditionalPhones(fieldValue.additionalPhones),
      ].filter(isDefined);
};
