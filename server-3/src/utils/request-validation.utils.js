const hasOwn = (value, key) => (
    Boolean(value) && Object.prototype.hasOwnProperty.call(value, key)
);

export const storeValidatedRequestData = (req, source, value) => {
    if (!req.validated || typeof req.validated !== 'object') {
        req.validated = Object.create(null);
    }

    req.validated[source] = value;
};

export const getValidatedRequestData = (req, source) => {
    if (!hasOwn(req.validated, source)) {
        throw new Error(
            `Validated request ${source} is unavailable. Ensure validate(..., '${source}') runs before the controller.`,
        );
    }

    return req.validated[source];
};
