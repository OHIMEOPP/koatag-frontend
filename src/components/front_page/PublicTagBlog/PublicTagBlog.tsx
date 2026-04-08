const PublicTagBlog = () => {

    const user_id = localStorage.getItem('user_id');

    function displayanime(tagLinks: HTMLElement[]) {
        tagLinks.forEach(function (tag: HTMLElement, k: number) {
            setTimeout(() => {
                tag.classList.add("visible")
            }, k * 20)
        });
    }

    function getRefrenceTag(array: string[]) {
        array = array.length === 0 ? ['沒有標籤'] : array;
        let refrenceTagContainer = document.getElementById('refrenceTag');
        if (!refrenceTagContainer) return
        refrenceTagContainer.textContent = '';
        array.forEach(element => {
            const a = document.createElement("a");
            a.draggable = true;
            a.textContent = element;
            a.href = "indexTWO.php?tag=" + element + "&&page=1";
            // a.onclick = function () {
            //   trackClickEvent();
            // }
            refrenceTagContainer?.appendChild(a);
        });
        const refrenceTagLinks = Array.from(document.querySelectorAll('#refrenceTag a')) as HTMLElement[];
        displayanime(refrenceTagLinks);
    }
    async function getPublicTag(colume: string) {
        let publicTag: string[] = ['']
        await axios.post<string[]>('http://koatag.com:1900/getRefrenceTag', {
            colume: colume,
            user_id: user_id
        }, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                publicTag = response.data;
            })
            .catch(error => {
                console.error(`find images is fail -> ${error}`)
            })
        return getRefrenceTag(publicTag);
    }
    return (
        <>
            <div className="co1-1">
                <div className="taghead">
                    <h3>參考標籤</h3>
                </div>
                <p id='taggroupline'>
                    <a onClick={() => getPublicTag('tag_name')}>標籤</a>
                    <a onClick={() => getPublicTag('ArtistTag')}>作者</a>
                    <a onClick={() => getPublicTag('mainTag')}>人物</a>
                    <a onClick={() => getPublicTag('secondaryTag')}>團體</a>
                </p>
                <div className="refrenceTag" id="refrenceTag"></div>
            </div>
        </>
    )
}
export { PublicTagBlog }