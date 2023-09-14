type ActionType = 'message' | 'join-room' | 'create-room' | 'leave-room' | 'share-rooms' | 'share-clients' | 'add-peer' | 'remove-peer' | 'answer' | 'offer' | 'ice-candidate' | 'session-description' | 'login' | 'logout';

type DataType = {
    method: ActionType;
    from: string;
    to?: string;
    message?: any;
}

type ClientType = {
    clientId: string,
    socket: WebSocket
}