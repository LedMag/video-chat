const generateToken = (size: number): string => {
    const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
    const NUMBERS = '0123456789';

    const CHARACTERS = UPPERCASE + LOWERCASE + NUMBERS;
    let token = '';

    for (let i = 0; i < size; i++) {
        const randomIndex = Math.floor(Math.random() * CHARACTERS.length);
        token += CHARACTERS.charAt(randomIndex);
    }

    return token;
}