/**
 * 房间抛出的异常
 */
class RoomException extends Error {
    private readonly roomId: string;

    constructor(roomId: string, message: any) {
        super(message);

        this.roomId = roomId;
        this.message = message;
    }

    public getRoomId(): string {
        return this.roomId;
    }

    public getMessage(): string {
        return this.message;
    }
}

export default RoomException;