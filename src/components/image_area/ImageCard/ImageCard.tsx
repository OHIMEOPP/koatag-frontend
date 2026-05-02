import { ImageData } from 'components/types/images';
import { useState } from 'react';

import '../../../style/image_area/ImageCard/ImageCard.scss';

import { getFilePath } from 'utils';
import { Icon } from 'components';

interface ImageCardPorps {
    image: ImageData;
    editMode: boolean;
}

const ImageCard: React.FC<ImageCardPorps> = ({ image, editMode }) => {

    const user_id = localStorage.getItem('user_id') ?? '0';
    const [imageEerror, setImageError] = useState(true);
    const [check, setCheck] = useState(false);


    return (
        <>
            <div onClick={(e) => setCheck(!check)} key={image.id} className={`out ${editMode ? "pos" : ""} ${check ? "check" : ""}`}>

                <div className='amoutView'>
                    <div data-tooltip-content={"人物"} data-tooltip-id='tooltip' className="tagItem">
                        <Icon.user />
                        <span>{image.mainTag?.length ?? 0}</span>
                    </div>
                    <div data-tooltip-content={"團體"} data-tooltip-id='tooltip' className="tagItem">
                        <Icon.user />
                        <span>{image.secondaryTag?.length ?? 0}</span>
                    </div>
                    <div data-tooltip-content={"作者"} data-tooltip-id='tooltip' className="tagItem">
                        <Icon.edit />
                        <span>{image.ArtistTag?.length ?? 0}</span>
                    </div>
                    <div data-tooltip-content={"其他"} data-tooltip-id='tooltip' className="tagItem">
                        <Icon.star />
                        <span>{image.anotherTag?.length ?? 0}</span>
                    </div>
                </div>

                <div className="img_frame">
                    <a href={editMode ? "#" : `/main/image_page?img_id=${image.id}`}>
                        {
                            imageEerror ?
                                <img
                                    src={image.check_img_type === 'HTTP' ? image.img_path : `${getFilePath(user_id, image.img_path)}`}
                                    className="col-xs-12 col-sm-4"
                                    alt="..."
                                    onLoad={() => setImageError(true)}
                                    onError={() => setImageError(false)}
                                />
                                :
                                <div className="img_frame thumb placeholder">
                                    無圖片
                                </div>
                        }
                    </a>
                </div>
                <div className='staView'>
                    <div className="tagItem">
                        <Icon.heart />
                        <span>{image.secondaryTag?.length ?? 0}</span>
                    </div>
                </div>
                {
                    editMode &&
                    <input
                        type='checkbox'
                        id={String(image.id)}
                        name='imagesId'
                        checked={check}
                        className='image-check'
                    />
                }
            </div>
        </>
    )
}

export { ImageCard };