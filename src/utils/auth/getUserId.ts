const getUserId = (): string => {
    let userId = localStorage.getItem('user_id');
    if (!userId || userId === 'null') {
        const userRaw = localStorage.getItem('user');
        const user = userRaw ? JSON.parse(userRaw) : null;
        userId = user ? String(user.id) : '0';
    }
    return userId;
};

export { getUserId };
