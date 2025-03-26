/**
 * Rest风格的异常
 */
class RestException extends Error {
    private readonly code: string;

    constructor(message: any) {
        super(message);

        this.code = 'fail';
        this.message = message;
    }

    public getMessage(): string {
        return this.message;
    }

    public getCode(): string {
        return this.code;
    }
}

export default RestException;