import type { ValidationConfig, CellValue, DataType } from '@/types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * 셀 값 유효성 검사
 */
export function validateCellValue(
  value: CellValue,
  validation?: ValidationConfig
): ValidationResult {
  // 유효성 설정이 없으면 항상 유효
  if (!validation) {
    return { isValid: true };
  }

  const { dataType, min, max, required, allowedValues } = validation;

  // 필수 입력 검사
  if (required && (value === null || value === undefined || value === '')) {
    return { isValid: false, error: '필수 입력 항목입니다' };
  }

  // 빈 값은 required가 아니면 통과
  if (value === null || value === undefined || value === '') {
    return { isValid: true };
  }

  // 데이터 타입 검사
  if (dataType && dataType !== 'any') {
    const typeResult = validateDataType(value, dataType);
    if (!typeResult.isValid) {
      return typeResult;
    }
  }

  // 숫자인 경우 min/max 검사 — `Number()` 로 문자열 전체가 숫자일 때만 변환
  const numValue = typeof value === 'number' ? value : Number(String(value));

  if (!isNaN(numValue)) {
    if (min !== undefined && numValue < min) {
      return { isValid: false, error: `최솟값은 ${min}입니다 (현재: ${numValue})` };
    }
    if (max !== undefined && numValue > max) {
      return { isValid: false, error: `최댓값은 ${max}입니다 (현재: ${numValue})` };
    }

    // 경고: 값이 경계에 가까운 경우
    if (min !== undefined && max !== undefined) {
      const range = max - min;
      if (numValue < min + range * 0.1) {
        return { isValid: true, warning: '최솟값에 근접한 값입니다' };
      }
      if (numValue > max - range * 0.1) {
        return { isValid: true, warning: '최댓값에 근접한 값입니다' };
      }
    }
  }

  // 허용된 값 목록 검사
  if (allowedValues && allowedValues.length > 0) {
    const strValue = String(value);
    if (!allowedValues.includes(strValue)) {
      return {
        isValid: false,
        error: `허용된 값: ${allowedValues.join(', ')}`,
      };
    }
  }

  return { isValid: true };
}

/**
 * 데이터 타입 검사
 */
function validateDataType(value: CellValue, dataType: DataType): ValidationResult {
  const strValue = String(value);

  switch (dataType) {
    case 'number': {
      const num = Number(strValue);
      if (isNaN(num)) {
        return { isValid: false, error: '숫자만 입력 가능합니다' };
      }
      return { isValid: true };
    }

    case 'integer': {
      const num = Number(strValue);
      if (isNaN(num)) {
        return { isValid: false, error: '정수만 입력 가능합니다' };
      }
      if (!Number.isInteger(num)) {
        return { isValid: false, error: '정수만 입력 가능합니다 (소수점 불가)' };
      }
      return { isValid: true };
    }

    case 'text': {
      if (typeof value === 'number') {
        return { isValid: true, warning: '숫자가 텍스트로 저장됩니다' };
      }
      return { isValid: true };
    }

    default:
      return { isValid: true };
  }
}

/**
 * 유효성 오류 메시지 포맷
 */
