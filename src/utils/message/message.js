const statusList = ['info', 'message', 'warning', 'error'];

export function $message(msg, type = 'info') {
    if(!statusList.includes(type)) type = 'info';
    let wrapper = document.querySelector('.custom-message-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'custom-message-wrapper';
        document.body.appendChild(wrapper);
    }

    const box = document.createElement('div');
    box.className = `custom-message ${type}`;
    box.textContent = msg;

    wrapper.appendChild(box);

    // 淡入動畫
    requestAnimationFrame(() => {
        box.classList.add('show');
    });

    // 淡出並移除
    setTimeout(() => {
        box.classList.remove('show');
        setTimeout(() => box.remove(), 300);
    }, 3000);
}
