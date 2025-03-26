
class DataResp<T> {

    private code: string;
    private msg?: string;
    private data?: T;
    constructor(code: string = 'success', msg: string = '', data?: T) {
        this.code = code;
        this.msg = msg;
        this.data = data;
    }
    static success<T>(msg?:string): DataResp<T> {
        const dataResp = new DataResp<T>();
        dataResp.setCode('success');
        dataResp.setMsg(msg);
        return dataResp;

    }
    static fail<T>(msg:string): DataResp<T> {
        const dataResp = new DataResp<T>();
        dataResp.setCode('fail');
        dataResp.setMsg(msg);
        return dataResp;
    }

    getCode(): string {
        return this.code;
    }

    setCode(value: string) {
        this.code = value;
    }

    getMsg(): string|undefined {
        return this.msg;
    }

    setMsg(value?: string) {
        this.msg = value;
    }

    getData(): T | undefined {
        return this.data;
    }

    setData(value: T) {
        this.data = value;
        return this;
    }

    isSuccess(): boolean {
        return this.code === 'success';
    }
}
export default DataResp;
