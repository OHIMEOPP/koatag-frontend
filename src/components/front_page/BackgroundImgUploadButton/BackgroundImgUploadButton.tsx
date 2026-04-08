import { UploadInterfaceImage } from "services/image.service";
import { $message, FlushLocalStrage } from "utils";

const BackgroundImgUploadButton = () => {
    const $id = (id: string) => document.getElementById(id) as HTMLInputElement;

    async function autoSubmit(files: FileList, InputId: string, ImageType: string, HTMLImgID: string) {
        if (!InputId || !files || !ImageType) return;
        const input = $id(InputId)
        $message('上傳中...');

        const file = files[0];
        if (file) {
            // console.log('檔案大小:', file.size);
            const formData = new FormData();
            formData.append(ImageType, file)
            try {
                // console.log('上傳至frontpage_controller 做圖片檔案移動 與 更新DB');
                const response = await UploadInterfaceImage(formData)

                if (response.status === 200 || response.status === 201) {
                    URL.createObjectURL(file);
                    if (ImageType === 'backGoundImage') {
                        const body = document.querySelector('body')
                        if (!body) return;
                        body.style.backgroundImage = `url(${process.env.REACT_APP_IMAGE_URL}/${response.data.path})`;

                    }
                    FlushLocalStrage()
                    $message('上傳成功');

                }
                input.value = "";
            } catch (error) {
                // console.log('上傳失敗', error);
                $message(`上傳失敗\n${error} `, 'error')
            }
        } else {
        }
    }

    return (
        <>
            <div className="upload_BG_ImgAre">
                {/* <!-- 上傳圖片的地方 --> */}
                <form className="from" id="form" method="post" encType="multipart/form-data" >
                    <div className="upload_BG_ImgAre_inputButton">
                        {/* <!-- 選擇上傳圖片 --> */}
                        <input type="file" id="upImg" onChange={(e) => {
                            if (!e.target.files || e.target.files.length === 0) return;
                            autoSubmit(e.target.files, 'upImg', 'backGoundImage', 'BG_Image');
                        }} accept="image/*" name="backGoundImage" style={{ display: "none" }} />

                        <label htmlFor="upImg">
                            {/* <!-- 上傳圖片按鈕的圖片 --> */}
                            <img id="BG_Image" src="/uploadIMG.png" alt="" width="100" height="100" />
                        </label>
                    </div>
                </form>

            </div>
        </>
    )
}
export { BackgroundImgUploadButton }