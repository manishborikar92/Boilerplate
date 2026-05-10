import { serialize } from './serializer.js';

const normalizeData = (value) => {
  const serialized = serialize(value ?? {});
  return serialized ?? {};
};

export class ApiResponse {
  static success(data = {}, message = 'Success') {
    return {
      success: true,
      message,
      data: normalizeData(data),
    };
  }

  static error(message = 'Error', data = {}) {
    return {
      success: false,
      message,
      data: normalizeData(data),
    };
  }

  static paginated(items = [], pagination = {}, message = 'Success', extraMeta = {}) {
    return {
      success: true,
      message,
      data: normalizeData(Array.isArray(items) ? items : []),
      meta: normalizeData({
        pagination,
        ...extraMeta,
      }),
    };
  }
}
