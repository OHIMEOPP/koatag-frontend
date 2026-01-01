import { useEffect, useState } from "react";

import '../style/front_page/front_page.scss'
import "cropperjs/dist/cropper.css";
import "../style/front_page/CropperEditer/CropperEditer.scss";

import { PublicTagBlog, ProfileHeader, BackgroundImgUploadButton, TagEditor, Data, TagBlog } from "components";
import { _dynamictagtype } from "utils";
import api from "api/axios";

interface ImageResponse {
  status: number;
  message: string;
  result: Data;
  data: Data
  path: string;
}

const Front_page = () => {
  const [tags, setTags] = useState<Data>()
  const [isTagEditor, setIsTagEditor] = useState(false);
  useEffect(() => {
    current();
  }, []);

  let user_id = localStorage.getItem('user_id');
  if (!user_id) {
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    user_id = user ? user.id : null;
  }

  async function current() {
    const response = await api.get<ImageResponse>(`${process.env.REACT_APP_NODERED_API_URL}/pageInfo/getImageForFront/${user_id}`);
    console.log(response.data.result);
    setTags(response.data.result);
  }

  function openEdit() {
    setIsTagEditor(true);
    document.body.classList.toggle('no-scroll', !isTagEditor);
    window.scrollBy(0, 0);
  }

  return (
    <>
      {
        isTagEditor &&
        <TagEditor
          onClose={() => { setIsTagEditor(false); document.body.classList.toggle('no-scroll', !isTagEditor); }}
          tagtype={tags?.tagsType}
          UncategorizedTags={tags?.UncategorizedTags}
          tagTypeClassification={_dynamictagtype(tags?.tagsGroup)} />
      }

      <div className="mainframe">
        {/* <!--div為容器 class名稱為waring--> */}
        <ProfileHeader />
        <div className="warning_out">
          <div className="front-index">
            <div className="front">
              <div className="front_right">
                <TagBlog 
                tags={tags}
                openEdit={openEdit}/>
                <PublicTagBlog />
                <div className="co1-1">
                  <span className="">label asd</span>
                </div>
              </div>
              <div className="front_left">
                <div className="co1-2">
                  <h3 className="">內容</h3>
                  <p className="">擁有的圖片數量: {tags?.images_Amount ?? 0} </p>
                  <p className="">擁有的標籤數量: {tags?.tags_Amount ?? 0} </p>
                  <p className="">人物標籤數量: {tags?.mainTag_Amount ?? 0} </p>
                  <p className="">團體標籤數量: {tags?.secondaryTag_Amount ?? 0} </p>
                  <p className="">作者標籤數量: {tags?.artist_Amount ?? 0} </p>
                  <p className="">其他標籤數量: {tags?.anotherTag_Amount ?? 0} </p>
                  <p className="">重複標籤數量: {tags?.duplicateTag.length ?? 0} </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BackgroundImgUploadButton />
      </div>

    </>
  );
};


export { Front_page }