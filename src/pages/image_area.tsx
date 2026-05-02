import { getImageForImageReposity, UploadImages } from 'services/image.service';

import { useEffect, useRef, useState } from 'react';

import '../style/image_area/image_area.scss';
import { Data, ImageCard, ImageResponseType, TagInput, Icon } from 'components';
import { getUploadAreaInfo } from 'services/pageInfo/upload_page.service';
import { $message, delay } from 'utils';
import { useNavigate } from 'react-router-dom';

const urlParams = new URLSearchParams(window.location.search);

const Image_area = () => {

  const navigate = useNavigate();
  const [sortMethod, setSortMethod] = useState(localStorage.getItem('sortMethod') ?? 'desc');
  const [sortValue, setSortValue] = useState(localStorage.getItem('sortValue') ?? '上傳日期');
  const [editMode, setEditMode] = useState(false)
  const [tagInputHandler, setTagInputHandler] = useState(0);
  const [images, setImages] = useState<ImageResponseType>();
  const formRef = useRef<HTMLFormElement>(null);
  const [imageData, setImageData] = useState<Data>();

  const page = parseInt(urlParams.get('page') ?? '1', 10)
  const strTag = urlParams.get('tag') ? `&tag=${urlParams.get('tag')}` : '';
  const totalPageAmount = Math.ceil(Number(images?.count ?? 0) / 30);

  // 頁數超出防護機制
  useEffect(() => {
    if (totalPageAmount < page && totalPageAmount !== 0) {
      navigate("/main/image_area?page=1");
      window.location.reload();
    }

  }, [totalPageAmount])
  const groupedTags: Record<string, string[]> = imageData?.tagsGroup?.reduce((acc, tag) => {
    if (!acc[tag.type]) acc[tag.type] = [];
    acc[tag.type].push(tag.tag_name); // 只存字串
    return acc;
  }, {} as Record<string, string[]>) || {};

  const tagTypes = [
    {
      group: '人物',
      originTags: imageData?.OmainTag || '',
      // 人物標籤的所有tag
      Tags: imageData?.mainTags,
      name: "mainTag"
    },
    {
      group: '團體',
      originTags: imageData?.OsecondaryTag || '',
      // 團體標籤的所有tag
      Tags: imageData?.secondaryTags,
      name: "secondaryTag"
    },
    {
      group: '作者',
      originTags: imageData?.OArtistTag || '',
      // 作者標籤的所有tag
      Tags: imageData?.artistTags,
      name: "ArtisTag"
    },
    {
      group: '其他',
      // 其他標籤的所有tag
      originTags: imageData?.OanotherTag || '',
      // Tags: imageData?.anotherTag,
      name: "anotherTag"
    }];

  const visiblePages = 7
  const startPage = Math.max(1, page - visiblePages);
  const endPage = Math.min(totalPageAmount, page + visiblePages);
  // console.log(totalPageAmount)
  useEffect(() => {
    // FlushLocalStrage();
    handleSubmit(true);
    // console.log(sortMethod, sortValue, urlParams.get('tag'));
  }, [sortMethod, sortValue, urlParams.get('tag')]);
  useEffect(() => {
    getUploadAreaInfo()
      .then(res => {
        setImageData(res.data);
      })
  }, [])

  const showsortimg = async (newSortValue: string | null, toggleMethod: boolean = false) => {
    // 改動：用新的參數名稱避免與 state 混淆
    setEditMode(false);
    if (newSortValue) {
      setSortValue(newSortValue);
      localStorage.setItem('sortValue', newSortValue);
    }

    if (toggleMethod) {
      // 改動：直接用 state 來切換排序方法，不再讀 localStorage
      setSortMethod(prev => {
        const newMethod = prev === 'desc' ? 'asc' : 'desc';
        localStorage.setItem('sortMethod', newMethod);
        return newMethod;
      });
    }

    // 提交表單更新圖片列表
    // handleSubmit(false);
  }

  const batchEditSubmit = async () => {
    const input = document.querySelector('input[name="tagGroup"]') as HTMLInputElement;
    const tag = document.querySelector('input[name="tagGroup"]:checked') as HTMLInputElement;
    const checks = document.querySelectorAll('input[name="imagesId"]:checked');
    if (!input) return;

    let imgId = Array.from(checks).map(check => +check.id);

    if (imgId.length === 0) {
      alert('請選擇圖片');
      return;
    } else if (!tag) {
      alert('請選擇一個種類');
      return;
    } else if (input.value === '') {
      alert('請輸入標籤');
      return;
    }
    let _type = "";
    switch (tag.value) {
      case '人物':
        _type = 'mainTag';
        break;
      case '團體':
        _type = 'secondaryTag';
        break;
      case '作者':
        _type = 'ArtistTag';
        break;
      case '其他':
        _type = 'anotherTag';
        break;
    }
    const inputValues = [tag.value, input.value, imgId];
    const batchForm = formRef.current;
    if (!batchForm) return;
    const formData = new FormData(batchForm);

    formData.set('imagesId', JSON.stringify(imgId))
    formData.set('tagGroup', _type)
    // window.confirm("確定送出嗎?");
    // eslint-disable-next-line no-restricted-globals
    if (confirm(`確定送出嗎? \n 輸入內容為：\n種類: ${inputValues[0]}\n增加標籤: ${inputValues[1]}\n選擇圖片數量: ${inputValues[2]}`) === true) {
    } else {
      return;
    }
  }

  async function handleSubmit(init: boolean) {
    try {
      const requestType = urlParams.get("group") ?? "";
      const tags = urlParams.getAll("tag");

      let tag: any = null;
      if (tags.length === 0) {
        tag = null;
      } else if (requestType) {
        tag = { [requestType]: tags };
      } else {
        tag = tags;
      }
      const form = formRef.current;
      if (!form) return;

      const formData = new FormData(form)
      formData.set('order', sortMethod);
      formData.append('amount', '30');
      formData.append('page', `${parseInt(urlParams.get('page') ?? '1') - 1}`);
      formData.append('userId', `${localStorage.getItem('user_id')}`);
      formData.append('tag', JSON.stringify(tag));
      formData.forEach((value, key) => {
        // console.log(key, value);
      });
      const response = await getImageForImageReposity(formData);

      setImages(response);
      // console.log(images)
    } catch (error) {
      console.error('find images is fail ->', error);
      return;
    }
  }

  return (
    <>
      <form ref={formRef} className="mainArea">
        <aside className="workZone" aria-label="操作面板">
          <div className="brand">
            <h3>圖庫管理</h3>
            <small className="muted">快速篩選 / 批量編輯</small>
          </div>

          {/* 排序區 */}
          <div className="sortArea">
            <label htmlFor="select_sort" className="sr-only">排序方式</label>
            <select
              id="select_sort"
              name="selectSort"
              value={sortValue}
              onChange={(e) => showsortimg(e.target.value)}
            >
              <option value="上傳日期">上傳日期</option>
              <option value="ID">ID</option>
              <option value="圖片名稱">圖片名稱</option>
              <option value="人物">人物</option>
              <option value="團體">團體</option>
              <option value="作者">作者</option>
              <option value="public">全體公開圖</option>
              <option value="人物未修改">人物未修改</option>
              <option value="團體未修改">團體未修改</option>
              <option value="作者未修改">作者未修改</option>
              <option value="其他標籤未修改">其他標籤未修改</option>
            </select>

            <button
              type="button"
              className="iconBtn"
              title="切換排序 (升/降)"
              onClick={() => showsortimg(null, true)}
            >
              <span style={{ display: 'inline-flex', transform: sortMethod === "desc" ? "rotate(90deg)" : "rotate(-90deg)", transition: "transform 0.2s" }} aria-hidden>
                <Icon.chevronRight />
              </span>
            </button>
          </div>

          {/* 批量編輯區 */}
          <div className={`batchEditAre ${editMode ? "active" : ""}`}>
            {editMode ? (
              <>
                <div id="input_area" className="inputsWrap">
                  {tagTypes.map((tag, index) => (
                    <div className="radioRow" key={tag.group}>
                      <label>
                        <input
                          type="radio"
                          name="tagGroup"
                          value={tag.group}
                          onClick={() => setTagInputHandler(index + 1)}
                        />
                        <span className="radioLabel">{tag.group}</span>
                      </label>

                      {tagInputHandler === index + 1 && (
                        <div className="tagInputWrap">
                          <TagInput
                            allTags={
                              tagInputHandler === 4
                                ? groupedTags
                                : { [tag.group]: tag.Tags?.map((t) => t.tag_name) || [] }
                            }
                            value={""}
                            name={"tagName"}
                            onChange={(val) => {
                              const input = formRef.current?.elements.namedItem('tagName') as HTMLInputElement | null;
                              if (input) input.value = val;
                            }}
                            placeholder={`請輸入 ${tag.group} 標籤`}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div id="submit_buttons" className="actions">
                  <button
                    type="button"
                    className="btn primary"
                    onClick={(e) => {
                      e.preventDefault();
                      batchEditSubmit();
                    }}
                  >
                    完成
                  </button>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      setEditMode(false);
                    }}
                  >
                    取消
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="btn primary"
                onClick={(e) => {
                  e.preventDefault();
                  setEditMode(true);
                }}
              >
                批量編輯
              </button>
            )}
          </div>

          {/* 可放一個簡短說明或統計 */}
          <div className="meta">
            <p className="muted small">共 {images?.count ?? 0} 張圖片</p>
          </div>
        </aside>

        {/* 圖片顯示區 */}
        <div className="imgAre">
          <div className="content">
            <div className="contentblock">
              {images?.data.map((image) => (
                <ImageCard key={image.id} image={image} editMode={editMode} />
              ))}
            </div>

            {/* 分頁 */}
            <div className="pagebuttons">
              {page !== 1 && (
                <>
                  <a href={`/main/image_area?page=1${strTag}`}>首頁</a>
                  <a href={`/main/image_area?page=${page - 1}${strTag}`}>上一頁</a>
                </>
              )}

              {Array.from({ length: totalPageAmount + 1 }, (_, i) =>
                startPage <= i && i <= endPage ? (
                  <a
                    key={i}
                    href={
                      i === page ? "#" : `/main/image_area?page=${i}${strTag}`
                    }
                    className={`pagebutton ${i === page ? "active" : ""}`}
                  >
                    {i}
                  </a>
                ) : null
              )}

              {page !== totalPageAmount && (
                <>
                  <a href={`/main/image_area?page=${page + 1}${strTag}`}>下一頁</a>
                  <a href={`/main/image_area?page=${totalPageAmount}${strTag}`}>末頁</a>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </>
  )
}

export { Image_area }