import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isDesktop } from 'utils/desktop';
import { $message } from 'utils/message/message';

const FEEDBACK_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeCRn20iRshFMSg4n-bXDZS-pf-352Uu_PHYBnu-Ki5yPbf3w/viewform?usp=publish-editor';

const openFeedbackForm = async () => {
  try {
    await invoke('open_feedback_form', { url: FEEDBACK_FORM_URL });
  } catch {
    $message('無法開啟 Google 表單，請稍後再試', 'error');
  }
};

export const Feedback = () => (
  <div className="page">
    <div className="page-head">
      <div>
        <h1 className="t-h1 page-title">回報問題與反饋</h1>
        <p className="page-sub">請反映您的使用體驗、問題、建議</p>
      </div>
    </div>
    <div className="v-row" style={{ justifyContent: 'center' }}>
      {isDesktop() ? (
        <button type="button" className="btn btn-sm btn-primary" onClick={openFeedbackForm}>
          填寫 Google 表單
        </button>
      ) : (
        <a
          className="btn btn-sm btn-primary"
          href={FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          填寫 Google 表單
        </a>
      )}
    </div>
  </div>
);
