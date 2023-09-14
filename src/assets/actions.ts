const ACTIONS: Record<string, ActionType> = {
    MESSAGE: 'message',
    JOIN: 'join-room',
    CREATE: 'create-room',
    LEAVE: 'leave-room',
    SHARE_ROOMS: 'share-rooms',
    SHARE_CLIENTS: 'share-clients',
    ADD_PEER: 'add-peer',
    REMOVE_PEER: 'remove-peer',
    ANSWER: 'answer',
    OFFER: 'offer',
    ICE_CANDIDATE: 'ice-candidate',
    SESSION_DESCRIPTION: 'session-description',
    LOGIN: 'login',
    LOGOUT: 'logout'
};