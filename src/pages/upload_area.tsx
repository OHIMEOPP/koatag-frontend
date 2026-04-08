import React, { useEffect, useRef, useState } from 'react';
// import axios from 'axios';
import { $message, _dynamictagtype, sreach_drop } from 'utils'

import '../style/upload_area.scss'
import { UploadImage } from 'services/image.service';
import { getUploadAreaInfo } from 'services/pageInfo/upload_page.service';

import { Data, TagData } from 'components'
import { cleanFormData } from 'utils/formData/filterFormData';

interface Tag {
  tag_name: string;
}

const Upload_area: React.FC = () => {
  const [uploadImageType, setUploadImageType] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [uploadAreaInfo, setUploadAreaInfo] = useState<Data>();


  const demoRef = useRef<HTMLDivElement>(null);
  const _img_are_inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    getUploadAreaInfo()
      .then(res => {
        if (!res.data) return;
        setUploadAreaInfo(res.data);
      })
  }, [])

  const max_file_uploads = uploadAreaInfo?.max_file_uploads
  const upload_max_filesize_MB = uploadAreaInfo?.upload_max_filesize_MB
  const post_max_size_MB = uploadAreaInfo?.post_max_size_MB

  const fileAmount = document.getElementById("fileAmount") as HTMLDivElement;
  const httpUrlRef = useRef<HTMLInputElement>(null);

  function uploads(e: React.ChangeEvent<HTMLInputElement>) {
    //顯示上傳圖片
    const _img_are_input = _img_are_inputRef.current
    if (!_img_are_input || !max_file_uploads || !upload_max_filesize_MB || !post_max_size_MB) return
    const files = e.target.files;
    const maxFileUploads = max_file_uploads;
    const maxFileSize = upload_max_filesize_MB * 1024 * 1024;
    const postMaxSize = post_max_size_MB * 1024 * 1024; 

    let totalImgFileSize = 0;

    fileAmount.innerHTML = `圖片數量: 當前無圖片`;
    if (!files) return
    if (files.length > 0) {
      if (files.length > maxFileUploads) { // 限制文件数为 100
        $message(`最多只能上傳 ${maxFileUploads} 個文件！`, 'warning');
        const img = document.getElementById('_img') as HTMLDivElement
        img.innerHTML = "";
        _img_are_input.value = ''; // 清空已选文件
      } else {
        const img = document.getElementById('_img') as HTMLDivElement
        img.innerHTML = "";
        totalImgFileSize = 0;
        Array.from(files).forEach((file, index) => {
          totalImgFileSize += file.size;
          if (file.size >= maxFileSize) {
            $message(`${file.name} 為 ${(file.size / 1024 / 1024).toFixed(2)} MB 大於 ${upload_max_filesize_MB} MB！`, 'warming');
            _img_are_input.value = ''; // 清空已选文件
            return;
          } else {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);

            document.getElementById('_img')?.appendChild(img);

            // 清理 URL 防止內存洩漏
            img.onload = () => URL.revokeObjectURL(img.src);

            fileAmount.innerHTML = `圖片數量: ${index + 1}`;
          }

        });
        if (totalImgFileSize >= postMaxSize) {
          $message(`您的檔案總大小 ${(totalImgFileSize / 1024 / 1024).toFixed(2)} MB 超過 ${post_max_size_MB} MB！`, 'warning');
          _img_are_input.value = ''; // 清空已选文件
          const img = document.getElementById('_img') as HTMLDivElement
          img.innerHTML = "";
          fileAmount.innerHTML = `圖片數量: 當前無圖片`;
          return;
        }
        return;
      }
    }
  }
  function httpImageInputHandler() {
    const img = document.getElementById("img_are_IMG") as HTMLImageElement;
    const httpUrl = httpUrlRef.current

    const imageUrl = httpUrl?.value.trim();
    img.src = imageUrl ?? "";
    return;
  }

  function closeare(event: React.MouseEvent<HTMLButtonElement>, e: string, I_id: string) {
    //>團體 --人物
    event.preventDefault();
    const tagsGroup = uploadAreaInfo?.tagsGroup;
    const mainTags = uploadAreaInfo?.mainTags;
    const secondaryTags = uploadAreaInfo?.secondaryTags;
    const artistTags = uploadAreaInfo?.artistTags;
    const demo = demoRef.current;
    const searchInput = document.getElementById(I_id) as HTMLInputElement;
    const suggestionsDiv = document.getElementById('demo') as HTMLDivElement;
    let lastKeyword = "";

    if (!demo) return


    if (demo.className === "collapse") {
      demo.textContent = "";
      switch (e) {
        case "c_main":
          const suggestions = mainTags ?? ['沒有找到人物標籤'];
          sreach_drop(demo, suggestions, searchInput, lastKeyword, suggestionsDiv);
          break;
        case "c_secondary":
          const suggestions1 = secondaryTags ?? ['沒有找到團體標籤'];
          sreach_drop(demo, suggestions1, searchInput, lastKeyword, suggestionsDiv);
          break;
        case "c_artist":
          const suggestions2 = artistTags ?? ['沒有找到作者標籤'];
          sreach_drop(demo, suggestions2, searchInput, lastKeyword, suggestionsDiv);
          break;
        case "c_another":
          const tags = tagsGroup ?? ['沒有找到其他標籤'];
          const tagsGroup1: Record<string, Tag[]> = _dynamictagtype(tags);
          if (tagsGroup1) {
            Object.entries(tagsGroup1).forEach(([key, types]) => {
              const p = document.createElement("p");
              p.textContent = key;
              demo.appendChild(p);

              types.forEach(type => {
                const a = document.createElement('a');
                a.draggable = true;
                a.textContent = type.tag_name;

                demo.appendChild(a);
              });
            });
          }
          asdd(searchInput);
          break;
      }
    }
    keydownSelect(searchInput)
  }
  function asdd(searchInput: HTMLInputElement) {
    document.querySelectorAll('#demo a').forEach(a => {
      a?.addEventListener('click', function () {
        searchInput.focus();
        let parts = searchInput.value.split(","); // 依照逗號拆開
        parts[parts.length - 1] = a.textContent || ""; // ✅ 替換最後一個
        searchInput.value = parts.join(",");
      });
    });
  }

  function inputListaner(event: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>, e: string, I_id: string, suggestions: TagData[] | undefined) {
    const demo = demoRef.current;
    const searchInput = document.getElementById(I_id) as HTMLInputElement;
    const target = event.target as HTMLInputElement;
    const suggestionsDiv = document.getElementById('demo') as HTMLDivElement;
    let filteredSuggestions = [];
    let lastKeyword = "";
    let lastPartOfString = target.value.trim();
    var inputValue = target.value;

    if (!demo) return;
    if (!demo.classList.contains('in')) return;

    lastKeyword = inputValue.split(',').pop()?.trim() || '';
    if (inputValue.includes(',')) {
      // 將字串分割成陣列
      var arrayAfterComma = inputValue.split(',');
      // 取得逗號後的字串並加入陣列
      lastPartOfString = arrayAfterComma[arrayAfterComma.length - 1];
    }


    if (e !== "c_another") {
      filteredSuggestions = (suggestions || []).filter(
        (tag: Tag) => tag.tag_name?.includes(lastPartOfString)
      );

      sreach_drop(demo, filteredSuggestions, searchInput, lastKeyword, suggestionsDiv);

    } else {
      // console.log(suggestions);
      filteredSuggestions = (suggestions || []).filter(
        (tag: Tag) => tag.tag_name?.includes(lastPartOfString)
      );

      const tagsGroup: Record<string, Tag[]> = _dynamictagtype(filteredSuggestions);
      if (tagsGroup) {
        demo.innerHTML = "";
        Object.entries(tagsGroup).forEach(([key, types]) => {
          const p = document.createElement("p");
          p.textContent = key;
          demo?.appendChild(p);

          types.forEach(type => {
            const a = document.createElement('a');
            a.draggable = true;
            a.textContent = type.tag_name;

            demo?.appendChild(a);
          });
        });
      }
      asdd(searchInput);
    }
    keydownSelect(searchInput)
  }


  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = formRef.current;
    const imgEl = document.getElementById("_img");
    if (!form) return;

    $message("上傳中，請稍後...");
    // const formData = new FormData(form);
    const formData = cleanFormData(form, { removeEmpty: true });
    const response = await UploadImage(formData);
    if (response.status === 1) {
      $message(response.message)
      form.reset();
      if (imgEl) imgEl.innerHTML = "";
      fileAmount.innerHTML = `圖片數量: 當前無圖片`
    } else if (response.status === 2) {
      $message(response.message)
      form.reset();
      if (imgEl) imgEl.innerHTML = "";
      fileAmount.innerHTML = `圖片數量: 當前無圖片`
    } else {
      $message("網站出現錯誤", "error")
    }
  }

  function keydownSelect(input: HTMLInputElement) {
    let currentIndex = -1;

    if (!input) return;
    // ⚡ 只綁一次，不要重複
    if ((input as any)._keydownBound) return;
    (input as any)._keydownBound = true;

    input.addEventListener("keydown", function (e) {
      const suggestionLinks = document.querySelectorAll<HTMLAnchorElement>("#demo a");
      if (!suggestionLinks.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % suggestionLinks.length;
        updateHighlight(suggestionLinks, currentIndex);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + suggestionLinks.length) % suggestionLinks.length;
        updateHighlight(suggestionLinks, currentIndex);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentIndex >= 0 && suggestionLinks[currentIndex]) {
          suggestionLinks[currentIndex].click();
          currentIndex = -1;
          updateHighlight(suggestionLinks, currentIndex);
        }
      } else {
        currentIndex = -1;
        updateHighlight(suggestionLinks, currentIndex);
      }
    });
  }


  function updateHighlight(suggestionLinks: NodeListOf<HTMLAnchorElement>, currentIndex: number) {
    suggestionLinks.forEach((link, idx) => {
      link.style.backgroundColor = idx === currentIndex ? "#bde4ff" : "";
    });
  }


  return (
    <>
      <div className="upload_are">
        <div className="upload_form">
          {/* <div className="img_are"> */}

          <form method="POST" ref={formRef} onSubmit={handleSubmit} encType="multipart/form-data">
            <div className="img_are">
              <div className="_img" id="_img">
                <img src="" alt="" id="img_are_IMG" />
              </div>
              <div className="up_tag">
                <div>
                  <div className="img_are_input">
                    <label onClick={() => setUploadImageType(!uploadImageType)}><i className="material-icons" style={{ cursor: 'pointer' }}>change_circle</i></label>

                    {/* 切換上傳 HTTP 與 圖片檔案 */}
                    {
                      uploadImageType ?
                        <label className="btn btn-info" id="img_are_input">
                          <input type="file" id="_img_are_input" ref={_img_are_inputRef} accept="image/*" onChange={uploads} name="uploadimg[]"
                            style={{ display: 'none' }} multiple />
                          <i className="fa fa-photo"></i> 上傳圖片
                        </label>
                        :
                        <input type="text" ref={httpUrlRef} id="img_are_input_text" name="uploadimgHTTP" placeholder="輸入圖片位址(非網址)" onChange={httpImageInputHandler} />
                    }
                    <div className='sysFileInfo'>
                      <div style={{ margin: '5px', color: 'rgb(1, 40, 131)' }} id="fileAmount">圖片數量: 當前無圖片</div>
                      <div style={{ margin: '5px', color: 'rgb(1, 40, 131)' }} id="fileAmount">
                        單一圖片大小上限 {upload_max_filesize_MB} MB</div>
                      <div style={{ margin: '5px', color: 'rgb(1, 40, 131)' }} id="fileAmount">
                        總大小上限 {post_max_size_MB} MB</div>
                    </div>
                  </div>
                  <div className="input_tag">
                    <div className="main_tag">
                      <p>人物 (main Tag )</p>
                      <input onChange={(e) => inputListaner(e, 'c_main', 'main_tag', uploadAreaInfo?.mainTags)} type="text" name="mainTag" autoComplete="off" id="main_tag" />
                    </div>
                    <div className="second_tag">
                      <p>團體(second Tag)</p>
                      <input onChange={(e) => inputListaner(e, 'c_main', 'second_tag', uploadAreaInfo?.secondaryTags)} type="text" name="secondaryTag" autoComplete="off" id="second_tag" />
                    </div>
                    <div className="artist_tag">
                      <p>作者(artist Tag)</p>
                      <input onChange={(e) => inputListaner(e, 'c_main', 'ArtistTag', uploadAreaInfo?.artistTags)} type="text" name="ArtistTag" autoComplete="off" id="artist_tag" />
                    </div>
                  </div>
                  <p>圖源(source)</p>
                  <div className="source_zone">
                    <div>
                      <div style={{ display: 'flex' }}>
                        <textarea id="source_textare" name="source" placeholder="source"
                          autoComplete="off"></textarea>
                      </div>
                      <div style={{ display: 'flex' }}>
                        <p>圖片狀態(status)</p>
                        <label className="switch">
                          <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} id="toggleSwitch" name="isPublic" />
                          <span className="slider round"></span>
                        </label>
                        <p id="status">{isPublic ? "狀態: 公開" : "狀態: 私人"}</p>
                      </div>
                      <p>其他標籤(another Tag)</p>
                      <div className="another_tag">
                        <div style={{ display: 'flex' }}>
                          <textarea
                            onChange={(e) => inputListaner(e, 'c_another', 'textare', uploadAreaInfo?.tagsGroup)}
                            id="textare"
                            name="anotherTag"
                            placeholder="金髮,黑絲,藍瞳,.....(以半形豆號分隔)"
                            autoComplete="off"></textarea>

                        </div>
                        <div className="relate_tags">
                          <div>
                            <button onClick={(e) => closeare(e, 'c_main', 'main_tag')} id="c_main"
                              data-toggle="collapse" data-target="#demo">人物</button>
                            <button onClick={(e) => closeare(e, 'c_secondary', 'second_tag')} id="c_secondary"
                              data-toggle="collapse" data-target="#demo">團體</button>
                            <button onClick={(e) => closeare(e, 'c_artist', 'artist_tag')} id="c_artist"
                              data-toggle="collapse" data-target="#demo">作者</button>
                            <button onClick={(e) => closeare(e, 'c_another', 'textare')} id="c_another"
                              data-toggle="collapse" data-target="#demo">其他</button>
                          </div>
                          <label className="btn btn-info" id="img_are_input">
                            <button type="submit" id="upload_bt" style={{ display: 'none' }}></button><i
                              className="fa fa-photo"></i> 上傳
                          </label>
                        </div>
                      </div>
                    </div>
                    <div id="demo" ref={demoRef} className="collapse"></div>
                  </div>
                </div>
              </div>
            </div>
          </form>
          {/* </div> */}
        </div>
      </div>
    </>
  );
};

export { Upload_area };
