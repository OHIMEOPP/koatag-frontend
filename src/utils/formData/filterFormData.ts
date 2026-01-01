const cleanFormData = (
    form: HTMLFormElement,
    options?: { removeEmpty?: boolean }
): FormData => {
    const formData = new FormData(form);
    const cleaned = new FormData();

    formData.forEach((value, key) => {
        let newValue = value;

        if (typeof value === "string") {
            newValue = value.trim();
            if (options?.removeEmpty && newValue === "") {
                return; // skip empty values
            }
        }
        cleaned.append(key, newValue);
    });

    return cleaned;
}

export { cleanFormData }