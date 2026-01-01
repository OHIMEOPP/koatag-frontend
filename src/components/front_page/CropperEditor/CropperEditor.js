import { useRef, useState } from "react";
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import "../../style/front_page/CropperEditer/CropperEditer.scss";

export default function CropperEditor() {
  const cropperRef = useRef(null);

  // 刪
  const [isVisible, setIsVisible] = useState(false);

  // 刪
  const [avatar, setAvatar] = useState("");
  const [imageSrc, setImageSrc] = useState(null);

  function openEditor(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result);

      // 可刪
      setIsVisible(true);
    };
    reader.readAsDataURL(file);
  }

  function crop() {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) return;

    const canvas = cropper.getCroppedCanvas({
      width: 300,
      height: 300,
      imageSmoothingQuality: "high",
    });

    const circular = document.createElement("canvas");
    const ctx = circular.getContext("2d");
    circular.width = 300;
    circular.height = 300;
    ctx?.beginPath();
    ctx?.arc(150, 150, 150, 0, Math.PI * 2);
    ctx?.closePath();
    ctx?.clip();
    ctx?.drawImage(canvas, 0, 0, 300, 300);

    // 刪 改成設置image
    // body.style.backgroundImage = `url(${process.env.REACT_APP_IMAGE_URL}/${response.data.path})`;
    setAvatar(circular.toDataURL());
    setIsVisible(false);
  }

  function cancel() {
    setIsVisible(false);
    setImageSrc(null);
  }

  return (
    <>
      {/* 刪 */}
      <input
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) openEditor(file);
        }}
        type="file"
        id="upload"
        accept="image/*"

      />
      {/* 刪 */}
      {avatar && (
        <img
          id="avatar"
          src={avatar}
          alt="avatar"
          style={{ width: 100, height: 100, borderRadius: "50%", backgroundColor: "white" }}
        />
      )}

      {isVisible && (
        <div id="cropper-img-outlay" style={{ display: "flex" }}>
          <div className="cropper-warapper">
            <div className="cropper-headder">
              <div id="cropper-cencel" onClick={cancel} style={{ cursor: "pointer" }}>
                ×
              </div>
            </div>
            <div className="cropper-body">
              <div className="cropper-img" >
                <Cropper
                  src={imageSrc}
                  style={{ height: "500px", width: "500px" }}
                  aspectRatio={1}
                  viewMode={5}
                  dragMode="move"
                  cropBoxResizable={false}
                  background={false}
                  guides={true}
                  // cropBoxMovable={false}
                  autoCropArea={1}
                  ref={cropperRef}
                />
              </div>
            </div>
            <div className="cropper-footer">
              <button id="crop-reset" onClick={() => cropperRef.current?.cropper.reset()}>
                重製
              </button>
              <button onClick={crop} id="crop">
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
