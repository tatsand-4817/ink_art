/* ============================================
   GA4 Events Configuration
   GA4サンドボックス用イベント設定ファイル

   このファイルは GA4 で計測する全イベントの定義と
   自動トラッキングの設定を行います。

   ■ 計測イベント一覧:
   ─────────────────────────────────────────
   【自動計測（Enhanced Measurement相当）】
   - page_view          : ページビュー
   - scroll_depth       : スクロール深度 (25/50/75/90/100%)
   - search             : サイト内検索
   - file_download      : ファイルダウンロード
   - outbound_click     : 外部リンククリック

   【カスタムイベント】
   - cta_click          : CTAボタンクリック
   - tab_change         : タブ/フィルター切替
   - accordion_toggle   : アコーディオン開閉
   - modal_open         : モーダル表示
   - modal_close        : モーダル閉じ
   - video_start        : 動画再生開始
   - video_progress     : 動画再生進捗
   - video_complete     : 動画再生完了
   - video_pause        : 動画一時停止
   - theme_toggle       : テーマ切替
   - mobile_menu_toggle : モバイルメニュー開閉
   - scroll_to_top      : トップへ戻る
   - form_start         : フォーム入力開始
   - form_submit        : フォーム送信
   - select_content     : コンテンツ選択

   【Eコマースイベント（shop.html）】
   - view_item_list     : 商品一覧表示
   - select_item        : 商品選択
   - view_item          : 商品詳細表示
   - add_to_cart        : カート追加
   - remove_from_cart   : カート削除
   - view_cart          : カート表示
   - begin_checkout     : チェックアウト開始
   - add_shipping_info  : 配送情報入力
   - add_payment_info   : 支払い情報入力
   - purchase           : 購入完了
   ─────────────────────────────────────────
   ============================================ */

(function() {
  'use strict';

  // ============================================
  // GA4 Configuration
  // ============================================
  const GA4_CONFIG = {
    // Replace with your actual GA4 Measurement ID
    measurementId: 'G-XXXXXXXXXX',

    // Enable debug mode logging
    debug: true,

    // Custom dimensions (user properties)
    userProperties: {
      user_type: 'visitor',
      preferred_theme: localStorage.getItem('theme') || 'light'
    },

    // Enhanced measurement settings
    enhancedMeasurement: {
      scrollDepth: true,
      outboundClicks: true,
      siteSearch: true,
      fileDownloads: true,
      videoEngagement: true
    }
  };

  // ============================================
  // Session & User Tracking
  // ============================================

  // Generate or retrieve session ID
  function getSessionId() {
    let sessionId = sessionStorage.getItem('ga4_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('ga4_session_id', sessionId);
    }
    return sessionId;
  }

  // Track engagement time
  let engagementStart = Date.now();
  let totalEngagementTime = 0;
  let isPageVisible = true;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      totalEngagementTime += Date.now() - engagementStart;
      isPageVisible = false;
    } else {
      engagementStart = Date.now();
      isPageVisible = true;
    }
  });

  // Send engagement time on page unload
  window.addEventListener('beforeunload', () => {
    if (isPageVisible) {
      totalEngagementTime += Date.now() - engagementStart;
    }

    trackEvent('user_engagement', {
      engagement_time_msec: totalEngagementTime,
      session_id: getSessionId()
    });
  });

  // ============================================
  // Automatic Event Listeners
  // ============================================

  // --- Track all link clicks ---
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // External link detection
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      // Don't duplicate if already tracked via data attribute
      if (!link.hasAttribute('data-ga4-event')) {
        trackEvent('outbound_click', {
          destination: new URL(href).hostname,
          link_url: href,
          link_text: link.textContent.trim().substring(0, 100)
        });
      }
    }

    // File download detection
    const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.csv'];
    if (downloadExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
      if (!link.hasAttribute('data-ga4-event')) {
        const fileName = href.split('/').pop();
        trackEvent('file_download', {
          file_name: fileName,
          file_extension: fileName.split('.').pop(),
          link_url: href
        });
      }
    }
  });

  // --- Track form interactions ---
  const trackedForms = new Set();

  document.addEventListener('focusin', (e) => {
    const form = e.target.closest('form');
    if (!form) return;

    const formId = form.id || form.getAttribute('name') || 'unknown_form';

    if (!trackedForms.has(formId)) {
      trackedForms.add(formId);
      trackEvent('form_start', {
        form_id: formId,
        form_name: formId,
        first_field: e.target.name || e.target.id || 'unknown'
      });
    }
  });

  // --- Track form field interactions ---
  document.addEventListener('change', (e) => {
    const form = e.target.closest('form');
    if (!form) return;

    if (e.target.tagName === 'SELECT') {
      trackEvent('form_interaction', {
        form_id: form.id || 'unknown',
        field_name: e.target.name || e.target.id || 'unknown',
        field_type: 'select',
        selected_value: e.target.options[e.target.selectedIndex]?.text || ''
      });
    }
  });

  // --- Track form submissions ---
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const formId = form.id || form.getAttribute('name') || 'unknown_form';

    trackEvent('form_submit', {
      form_id: formId,
      form_name: formId,
      form_destination: form.action || window.location.href
    });
  });

  // --- Track element visibility (Intersection Observer) ---
  if ('IntersectionObserver' in window) {
    const observedSections = document.querySelectorAll('.section, .page-header');

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id || entry.target.querySelector('.section-title')?.textContent || 'unknown';
          trackEvent('section_view', {
            section_id: sectionId,
            section_title: entry.target.querySelector('.section-title')?.textContent || sectionId
          });
          sectionObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    observedSections.forEach(section => sectionObserver.observe(section));
  }

  // --- Track time on page milestones ---
  const timeOnPageMilestones = [30, 60, 120, 300]; // seconds
  const trackedTimeMilestones = new Set();

  setInterval(() => {
    if (!isPageVisible) return;
    const currentTime = Math.floor((Date.now() - engagementStart + totalEngagementTime) / 1000);

    timeOnPageMilestones.forEach(milestone => {
      if (currentTime >= milestone && !trackedTimeMilestones.has(milestone)) {
        trackedTimeMilestones.add(milestone);
        trackEvent('time_on_page', {
          seconds: milestone,
          page: window.location.pathname
        });
      }
    });
  }, 5000);

  // ============================================
  // GA4 Event Reference (for Debug Panel)
  // ============================================

  // Store event definitions for reference
  window.GA4_EVENT_REFERENCE = {
    // Enhanced Measurement
    page_view: { category: 'Enhanced', description: 'ページビュー' },
    scroll_depth: { category: 'Enhanced', description: 'スクロール深度' },
    search: { category: 'Enhanced', description: 'サイト内検索' },
    file_download: { category: 'Enhanced', description: 'ファイルダウンロード' },
    outbound_click: { category: 'Enhanced', description: '外部リンククリック' },

    // Custom Events
    cta_click: { category: 'Custom', description: 'CTAクリック' },
    tab_change: { category: 'Custom', description: 'タブ切替' },
    accordion_toggle: { category: 'Custom', description: 'アコーディオン開閉' },
    modal_open: { category: 'Custom', description: 'モーダル表示' },
    modal_close: { category: 'Custom', description: 'モーダル閉じ' },
    video_start: { category: 'Custom', description: '動画再生開始' },
    video_progress: { category: 'Custom', description: '動画再生進捗' },
    video_complete: { category: 'Custom', description: '動画再生完了' },
    video_pause: { category: 'Custom', description: '動画一時停止' },
    theme_toggle: { category: 'Custom', description: 'テーマ切替' },
    form_start: { category: 'Custom', description: 'フォーム入力開始' },
    form_submit: { category: 'Custom', description: 'フォーム送信' },
    form_interaction: { category: 'Custom', description: 'フォームフィールド操作' },
    select_content: { category: 'Custom', description: 'コンテンツ選択' },
    section_view: { category: 'Custom', description: 'セクション表示' },
    time_on_page: { category: 'Custom', description: '滞在時間マイルストーン' },
    user_engagement: { category: 'Custom', description: 'エンゲージメント時間' },

    // E-commerce
    view_item_list: { category: 'Ecommerce', description: '商品一覧表示' },
    select_item: { category: 'Ecommerce', description: '商品選択' },
    view_item: { category: 'Ecommerce', description: '商品詳細表示' },
    add_to_cart: { category: 'Ecommerce', description: 'カート追加' },
    remove_from_cart: { category: 'Ecommerce', description: 'カート削除' },
    view_cart: { category: 'Ecommerce', description: 'カート表示' },
    begin_checkout: { category: 'Ecommerce', description: 'チェックアウト開始' },
    add_shipping_info: { category: 'Ecommerce', description: '配送情報入力' },
    add_payment_info: { category: 'Ecommerce', description: '支払い情報入力' },
    purchase: { category: 'Ecommerce', description: '購入完了' }
  };

  // Log initialization
  if (GA4_CONFIG.debug) {
    console.log('[GA4 Sandbox] Initialized with config:', GA4_CONFIG);
    console.log('[GA4 Sandbox] Session ID:', getSessionId());
    console.log('[GA4 Sandbox] Available events:', Object.keys(window.GA4_EVENT_REFERENCE).length);
  }

})();
