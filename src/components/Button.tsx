import React from "react";
import "../style/Button.scss";

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    text?: string;
    type?: "button" | "submit" | "reset";
    className?: string;
    loadingText?: string;
}

const Button: React.FC<LoadingButtonProps> = ({
    loading = false,
    text = "送出",
    type = "button",
    className = "",
    loadingText = "處理中...",
    disabled,
    ...props
}) => {
    return (
        <button
            type={type}
            {...props}
            disabled={loading || disabled}
            className={`loadBt ${loading || disabled ? "loadBt-disabled" : ""} ${className}`}
        >
            {loading ? (
                <span className="loadBt-loading">
                    <span className="spinner" />
                    {loadingText}
                </span>
            ) : (
                text
            )}
        </button>
    );
};

export { Button };
