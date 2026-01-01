import CryptoJS from "crypto-js";

const SECRET_KEY = "983275hg92oejnrvzxn0"; // 你的固定金鑰

const getFolderName = (userId: string) => {
    if (!userId) return;
    // AES-128 需要 16 bytes，跟 PHP 一致 → 只取前 16 個字元
    const key = CryptoJS.enc.Utf8.parse(SECRET_KEY.substring(0, 16));

    // AES-128-ECB 加密 (PKCS7 padding)
    const encrypted = CryptoJS.AES.encrypt(userId.toString(), key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7,
    });

    // 轉成 HEX (大寫)
    const encryptedHex = encrypted.ciphertext.toString(CryptoJS.enc.Hex).toUpperCase();

    return `${encryptedHex}${userId}`;

}

const getFilePath = (userId: string, filePath: string) => {

    return `${process.env.REACT_APP_IMAGE_URL}/storage/uploadimg/${getFolderName(userId)}/${filePath}`;

}

export { getFolderName, getFilePath }