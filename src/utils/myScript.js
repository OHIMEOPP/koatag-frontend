export function sreach_drop(c_div, suggestions, searchInput, afterCommaStr, suggestionsDiv) {

    const ul = document.createElement('ul');
    c_div.innerHTML = "還沒有標籤喔~~";
    suggestions.sort((a, b) => a.length - b.length);

    c_div.innerHTML = "";
    suggestions.forEach(function (suggestion) {
        // c_div.innerHTML = "";
        const li = document.createElement('a');
        li.textContent = suggestion.tag_name;
        li.addEventListener('click', function () {
            searchInput?.focus();
            let currentValue = searchInput?.value.trim();

            // 取得最後一段（逗號之後的）
            let parts = currentValue?.split(',');
            let lastPart = parts[parts.length ?? 0 - 1].trim();

            // 如果最後一段是未完成詞（afterCommaStr），則替換
            if (afterCommaStr && lastPart === afterCommaStr) {
                parts[parts.length - 1] = suggestion.tag_name;
            } else {
                // 如果目前最後一個字元是逗號，代表用戶想要新增詞，不加逗號
                if (currentValue?.endsWith(',')) {
                } else if (currentValue !== '') {
                    currentValue += ','; // 正常加逗號
                }
                currentValue += suggestion.tag_name;
                searchInput.value = currentValue;
                return;
            }
            searchInput.value = parts.filter(p => p).join(',');
        });
        ul.appendChild(li);
    });
    suggestionsDiv.appendChild(ul);


}

export function _dynamictagtype( tags) {
    if (tags) {
        const groupedByType = tags.reduce((acc, tag) => {
            if (!acc[tag.type]) {
                acc[tag.type] = [];
            }
            acc[tag.type].push(tag);
            return acc;
        }, {});

        return groupedByType;
    }
}