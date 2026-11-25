// 放進 APP 隱藏的 x.com 視窗執行，抓 X 的書籤與喜歡
// 不呼叫 APP，結果存在 window.__koatag，由 Rust 輪詢讀回
// 解析邏輯搬自擴充套件 extension/bookmark-sync/x-api.js
(function () {
  if (window.__koatag) {
    return;
  }

  // queryId 與 features 用內建值，X 改版時更新這裡再發版
  const DEFAULT_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  const DEFAULT_BOOKMARKS_QUERY_ID = 'Glt3WAwBvNSPD-n_sqmX_A';
  const DEFAULT_LIKES_QUERY_ID = 'PgAssYGsPMMF1vVox5ysPg';
  const DEFAULT_FEATURES = {
    rweb_video_screen_enabled: false,
    rweb_cashtags_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    rweb_cashtags_composer_attachment_enabled: true,
    responsive_web_jetfuel_frame: true,
    rweb_sports_post_context_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    rweb_conversational_replies_downvote_enabled: false,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    responsive_web_nested_quote_preview_enabled: true,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };

  const results = {};

  function statusFromHttp(code) {
    if (code === 401) {
      return 'x_not_logged_in';
    }
    if (code === 429) {
      return 'x_rate_limited';
    }
    if (code === 400 || code === 404) {
      return 'x_api_changed';
    }
    if (code === 403) {
      return 'x_blocked';
    }
    return 'x_error';
  }

  // 照 X 畫面整理內文：拿掉附圖和引用推文自動補的 t.co，其他 t.co 換回原網址
  function cleanText(text, mediaEntities, urlEntities, quoteUrl) {
    for (const m of mediaEntities) {
      if (m.url) {
        text = text.split(m.url).join('');
      }
    }
    for (const u of urlEntities) {
      if (!u.url) {
        continue;
      }
      if (quoteUrl && u.url === quoteUrl) {
        text = text.split(u.url).join('');
        continue;
      }
      text = text.split(u.url).join(u.expanded_url || u.url);
    }
    // full_text 會把 & < > 轉成 HTML 字元
    text = text.split('&lt;').join('<').split('&gt;').join('>').split('&amp;').join('&');
    return text.trim();
  }

  function parseTweetEntry(entry) {
    let result = null;
    if (entry.content && entry.content.itemContent && entry.content.itemContent.tweet_results) {
      result = entry.content.itemContent.tweet_results.result;
    }
    if (!result) {
      return null;
    }
    if (result.__typename === 'TweetWithVisibilityResults') {
      result = result.tweet;
    }
    const legacy = result.legacy || {};

    let author = null;
    let user = null;
    if (result.core && result.core.user_results) {
      user = result.core.user_results.result;
    }
    if (user) {
      const userCore = user.core || {};
      const userLegacy = user.legacy || {};
      author = {
        id: user.rest_id,
        screenName: userCore.screen_name || userLegacy.screen_name,
        name: userCore.name || userLegacy.name,
        avatar: (user.avatar && user.avatar.image_url) || userLegacy.profile_image_url_https || null
      };
    }

    const entities = legacy.entities || {};
    let text = legacy.full_text || '';
    let urlEntities = entities.urls || [];
    if (result.note_tweet && result.note_tweet.note_tweet_results && result.note_tweet.note_tweet_results.result) {
      const note = result.note_tweet.note_tweet_results.result;
      text = note.text;
      if (note.entity_set && note.entity_set.urls) {
        urlEntities = note.entity_set.urls;
      }
    }
    let quoteUrl = null;
    if (legacy.quoted_status_permalink) {
      quoteUrl = legacy.quoted_status_permalink.url;
    }
    text = cleanText(text, entities.media || [], urlEntities, quoteUrl);

    const media = [];
    let mediaList = [];
    if (legacy.extended_entities && legacy.extended_entities.media) {
      mediaList = legacy.extended_entities.media;
    }
    for (const m of mediaList) {
      media.push({ type: m.type, url: m.media_url_https });
    }

    let url = null;
    if (author) {
      url = 'https://x.com/' + author.screenName + '/status/' + result.rest_id;
    }
    return {
      itemId: result.rest_id,
      author: author,
      text: text,
      createdAt: legacy.created_at,
      media: media,
      url: url
    };
  }

  // p：kind、cursor、ct0、userId
  async function fetchPage(p) {
    const features = DEFAULT_FEATURES;
    let variables;
    let url;
    if (p.kind === 'likes') {
      if (!p.userId) {
        return { ok: false, status: 'x_not_logged_in', kind: p.kind, items: [], nextCursor: null };
      }
      variables = {
        userId: p.userId,
        count: 20,
        includePromotedContent: false,
        withClientEventToken: false,
        withBirdwatchNotes: false,
        withVoice: true
      };
      if (p.cursor) {
        variables.cursor = p.cursor;
      }
      url = 'https://x.com/i/api/graphql/' + DEFAULT_LIKES_QUERY_ID + '/Likes'
        + '?variables=' + encodeURIComponent(JSON.stringify(variables))
        + '&features=' + encodeURIComponent(JSON.stringify(features))
        + '&fieldToggles=' + encodeURIComponent(JSON.stringify({ withPayments: false, withArticlePlainText: false }));
    } else {
      variables = { count: 20, includePromotedContent: false };
      if (p.cursor) {
        variables.cursor = p.cursor;
      }
      url = 'https://x.com/i/api/graphql/' + DEFAULT_BOOKMARKS_QUERY_ID + '/Bookmarks'
        + '?variables=' + encodeURIComponent(JSON.stringify(variables))
        + '&features=' + encodeURIComponent(JSON.stringify(features));
    }

    let res;
    try {
      res = await fetch(url, {
        credentials: 'include',
        headers: {
          'authorization': 'Bearer ' + decodeURIComponent(DEFAULT_BEARER),
          'x-csrf-token': p.ct0,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
          'content-type': 'application/json'
        }
      });
    } catch (e) {
      return { ok: false, status: 'x_error', kind: p.kind, items: [], nextCursor: null, detail: String(e) };
    }

    const bodyText = await res.text();
    if (!res.ok) {
      return { ok: false, status: statusFromHttp(res.status), kind: p.kind, items: [], nextCursor: null, detail: bodyText.slice(0, 300) };
    }

    let instructions;
    try {
      const body = JSON.parse(bodyText);
      if (p.kind === 'likes') {
        instructions = body.data.user.result.timeline.timeline.instructions;
      } else {
        instructions = body.data.bookmark_timeline_v2.timeline.instructions;
      }
    } catch (e) {
      return { ok: false, status: 'x_api_changed', kind: p.kind, items: [], nextCursor: null, detail: bodyText.slice(0, 300) };
    }

    const items = [];
    let nextCursor = null;
    for (const ins of instructions) {
      const entries = ins.entries || [];
      for (const entry of entries) {
        if (entry.entryId.startsWith('tweet-')) {
          const item = parseTweetEntry(entry);
          if (item) {
            items.push(item);
          }
        }
        if (entry.entryId.startsWith('cursor-bottom')) {
          nextCursor = entry.content.value;
        }
      }
    }
    return { ok: true, status: 'ok', kind: p.kind, items: items, nextCursor: nextCursor };
  }

  // 開始抓一頁，結果放進 results[reqId]
  function start(reqId, p) {
    fetchPage(p).then(
      (page) => {
        results[reqId] = page;
      },
      (e) => {
        results[reqId] = { ok: false, status: 'x_error', kind: p.kind, items: [], nextCursor: null, detail: String(e) };
      }
    );
    return true;
  }

  // 拿走結果，還沒好回 null
  function take(reqId) {
    if (!(reqId in results)) {
      return null;
    }
    const page = results[reqId];
    delete results[reqId];
    return page;
  }

  window.__koatag = { start: start, take: take };
})();
