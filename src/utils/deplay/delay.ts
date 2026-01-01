const delay = async (time: number) => {
    await new Promise(resolve => setTimeout(resolve, time * 1000));

}
export { delay }