const FlushLocalStrage = () => {
    localStorage.removeItem('WImage');
    localStorage.removeItem('icon');
    localStorage.removeItem('backGoundImage');
    localStorage.removeItem('requestType');
}

export { FlushLocalStrage }