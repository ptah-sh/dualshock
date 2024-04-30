export interface WebSocket {
    onOpen(callback: () => void): void;
    onMessage(callback: (data: ArrayBuffer) => void): void;
    onError(callback: (err: Error) => void): void;
    onClose(callback: () => void): void;

    send(data: ArrayBuffer): void;

    close(): void;
}
