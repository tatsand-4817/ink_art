/* ============================================
   Main JavaScript - Portfolio & GA4 Sandbox
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // --- Theme Toggle ---
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;

  // Load saved theme
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = html.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      html.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      updateThemeIcon(next);

      // GA4 event
      trackEvent('theme_toggle', { theme: next });
    });
  }

  function updateThemeIcon(theme) {
    if (themeToggle) {
      themeToggle.innerHTML = theme === 'light' ? '&#9790;' : '&#9728;';
    }
  }

  // --- Header Scroll Effect ---
  const header = document.getElementById('header');
  let lastScrollY = 0;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (header) {
      header.classList.toggle('scrolled', scrollY > 10);
    }
    lastScrollY = scrollY;
  });

  // --- Mobile Menu ---
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const nav = document.getElementById('nav');

  if (mobileMenuBtn && nav) {
    mobileMenuBtn.addEventListener('click', () => {
      nav.classList.toggle('open');
      trackEvent('mobile_menu_toggle', { state: nav.classList.contains('open') ? 'open' : 'close' });
    });

    // Close menu on nav link click
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

  // --- Site Search ---
  const searchInput = document.getElementById('site-search');
  let searchTimeout;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length >= 2) {
        searchTimeout = setTimeout(() => {
          trackEvent('search', { search_term: query });
          showToast(`"${query}" で検索しました`, 'info');
        }, 800);
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          trackEvent('search', { search_term: query });
          showToast(`"${query}" の検索結果はデモのため表示されません`, 'info');
        }
      }
    });
  }

  // --- Scroll to Top ---
  const scrollTopBtn = document.getElementById('scroll-top');

  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 400);
    });

    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      trackEvent('scroll_to_top', {});
    });
  }

  // --- Scroll Depth Tracking ---
  const scrollDepths = [25, 50, 75, 90, 100];
  const trackedDepths = new Set();

  window.addEventListener('scroll', () => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return;
    const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);

    scrollDepths.forEach(depth => {
      if (scrollPercent >= depth && !trackedDepths.has(depth)) {
        trackedDepths.add(depth);
        trackEvent('scroll_depth', { percent_scrolled: depth, page: window.location.pathname });
      }
    });
  });

  // --- CTA Click Tracking ---
  document.querySelectorAll('[data-ga4-event="cta_click"]').forEach(el => {
    el.addEventListener('click', () => {
      trackEvent('cta_click', {
        cta_label: el.getAttribute('data-ga4-label') || el.textContent.trim(),
        cta_url: el.href || '',
        page: window.location.pathname
      });
    });
  });

  // --- Outbound Click Tracking ---
  document.querySelectorAll('[data-ga4-event="outbound_click"]').forEach(el => {
    el.addEventListener('click', () => {
      trackEvent('outbound_click', {
        destination: el.getAttribute('data-ga4-destination') || el.href,
        link_text: el.textContent.trim()
      });
    });
  });

  // --- Content Selection Tracking ---
  document.querySelectorAll('[data-ga4-event="select_content"]').forEach(el => {
    el.addEventListener('click', () => {
      trackEvent('select_content', {
        content_type: el.getAttribute('data-ga4-content-type') || 'unknown',
        item_id: el.getAttribute('data-ga4-item-id') || ''
      });
    });
  });

  // --- File Download Tracking ---
  document.querySelectorAll('[data-ga4-event="file_download"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      trackEvent('file_download', {
        file_name: el.getAttribute('data-ga4-file-name') || 'unknown',
        file_url: el.href || '',
        link_text: el.textContent.trim()
      });
      showToast('PDFダウンロード（デモ）が開始されました', 'success');
    });
  });

  // --- Video Play Tracking ---
  const videoPlayBtn = document.getElementById('video-play-btn');
  const videoWrapper = document.getElementById('video-wrapper');
  let videoPlaying = false;
  let videoProgressInterval;

  if (videoPlayBtn && videoWrapper) {
    videoPlayBtn.addEventListener('click', () => {
      if (!videoPlaying) {
        videoPlaying = true;
        videoPlayBtn.innerHTML = '&#9646;&#9646;';
        trackEvent('video_start', {
          video_title: videoWrapper.getAttribute('data-ga4-video-title') || 'unknown',
          video_provider: 'self-hosted'
        });
        showToast('動画再生を開始しました（デモ）', 'info');

        // Simulate video progress
        let progress = 0;
        videoProgressInterval = setInterval(() => {
          progress += 25;
          if (progress <= 100) {
            trackEvent('video_progress', {
              video_title: 'how_i_work',
              video_percent: progress
            });
          }
          if (progress >= 100) {
            clearInterval(videoProgressInterval);
            trackEvent('video_complete', { video_title: 'how_i_work' });
            videoPlaying = false;
            videoPlayBtn.innerHTML = '&#9654;';
            showToast('動画再生が完了しました（デモ）', 'success');
          }
        }, 2000);
      } else {
        videoPlaying = false;
        clearInterval(videoProgressInterval);
        videoPlayBtn.innerHTML = '&#9654;';
        trackEvent('video_pause', { video_title: 'how_i_work' });
      }
    });
  }

  // --- Accordion Toggle ---
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      const body = item.querySelector('.accordion-body');
      const isActive = item.classList.contains('active');

      // Close all others
      document.querySelectorAll('.accordion-item').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
          const otherBody = otherItem.querySelector('.accordion-body');
          if (otherBody) otherBody.style.maxHeight = '0';
        }
      });

      // Toggle current
      item.classList.toggle('active');
      if (!isActive) {
        body.style.maxHeight = body.scrollHeight + 'px';
      } else {
        body.style.maxHeight = '0';
      }

      trackEvent('accordion_toggle', {
        item: header.textContent.trim().substring(0, 50),
        state: !isActive ? 'open' : 'close'
      });
    });
  });

  // --- Skill Bar Animation ---
  const skillBars = document.querySelectorAll('.skill-bar-fill');
  if (skillBars.length > 0) {
    const animateSkillBars = () => {
      skillBars.forEach(bar => {
        const rect = bar.getBoundingClientRect();
        if (rect.top < window.innerHeight - 50) {
          const value = bar.getAttribute('data-skill-value') || '0';
          bar.style.width = value + '%';
        }
      });
    };

    window.addEventListener('scroll', animateSkillBars);
    animateSkillBars(); // Initial check
  }

  // --- GA4 Debug Panel ---
  const debugToggle = document.getElementById('ga4-debug-toggle');
  const debugPanel = document.getElementById('ga4-debug-panel');
  const debugClear = document.getElementById('ga4-debug-clear');

  if (debugToggle && debugPanel) {
    debugToggle.addEventListener('click', () => {
      debugPanel.classList.toggle('open');
    });
  }

  if (debugClear) {
    debugClear.addEventListener('click', () => {
      const eventsContainer = document.getElementById('ga4-debug-events');
      if (eventsContainer) eventsContainer.innerHTML = '';
    });
  }

  // --- Page View Event ---
  trackEvent('page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname
  });

});

// ============================================
// Global Functions
// ============================================

/**
 * Track a GA4 event - sends to gtag AND logs to debug panel
 */
function trackEvent(eventName, params = {}) {
  // Send to GA4 (if gtag is loaded)
  if (typeof gtag === 'function') {
    gtag('event', eventName, params);
  }

  // Also push to dataLayer
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...params
  });

  // Log to debug panel
  logToDebugPanel(eventName, params);

  // Console log for development
  console.log(`[GA4] ${eventName}`, params);
}

/**
 * Log event to the visual debug panel
 */
function logToDebugPanel(eventName, params) {
  const container = document.getElementById('ga4-debug-events');
  if (!container) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('ja-JP');
  const paramsStr = Object.keys(params).length > 0
    ? Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(', ')
    : '';

  const item = document.createElement('div');
  item.className = 'ga4-event-item ga4-event-item-expandable';
  item.innerHTML = `
    <div class="ga4-event-row">
      <span class="event-name">${eventName}</span>
      <span class="event-time">${timeStr}</span>
    </div>
    ${paramsStr ? `<div class="event-params">${paramsStr}</div>` : ''}
  `;

  container.insertBefore(item, container.firstChild);

  // Keep max 50 events
  while (container.children.length > 50) {
    container.removeChild(container.lastChild);
  }
}

/**
 * Show a toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '&#10004;',
    info: '&#8505;',
    warning: '&#9888;',
    error: '&#10006;'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
