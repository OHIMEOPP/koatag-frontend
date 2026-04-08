import { ResponseType } from "components";

const parser = (imageData: ResponseType) => {
    let cleanJson = String(imageData).trim();
    const jsonStartIndex = cleanJson.indexOf('{');
    let parsedData: ResponseType;
    if(typeof imageData !== "string" && typeof imageData === "object")return imageData;
    try {
        parsedData = JSON.parse(cleanJson.slice(jsonStartIndex));
        return parsedData
    } catch (error) {
        console.error('JSON 解析失敗：', error);
        throw error;
    }
}
export { parser }