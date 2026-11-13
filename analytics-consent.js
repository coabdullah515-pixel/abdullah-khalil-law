/*
 * Site-wide analytics consent manager.
 * GA4 and GTM are inserted only after affirmative analytics consent.
 * The consent choice is shared across all routes on the same origin.
 */
(function () {
  'use strict';

  if (window.__abdullahConsentManagerInitialized) return;
  window.__abdullahConsentManagerInitialized = true;

  var STORAGE_KEY = 'abdullah_cookie_consent_v1';
  var ANALYTICS_ID = 'G-QMTN9HW82B';
  var GTM_ID = 'GTM-KJ5QQRJQ';
  var optionalTagsLoaded = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  function readChoice() {
    try { return window.localStorage.getItem(STORAGE_KEY); }
    catch (error) { return null; }
  }

  function saveChoice(value) {
    try { window.localStorage.setItem(STORAGE_KEY, value); }
    catch (error) { /* The in-memory choice still applies to this page. */ }
  }

  function setGoogleConsent(granted) {
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    });
  }

  function appendScript(src, attributeName, attributeValue) {
    var selector = 'script[' + attributeName + '="' + attributeValue + '"]';
    if (document.querySelector(selector)) return;
    var script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.setAttribute(attributeName, attributeValue);
    document.head.appendChild(script);
  }

  function loadOptionalTags() {
    if (optionalTagsLoaded) return;
    optionalTagsLoaded = true;
    setGoogleConsent(true);
    window.gtag('js', new Date());
    window.gtag('config', ANALYTICS_ID);
    appendScript('https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS_ID,
      'data-abdullah-analytics', ANALYTICS_ID);
    appendScript('https://www.googletagmanager.com/gtm.js?id=' + GTM_ID,
      'data-abdullah-gtm', GTM_ID);
  }

  function showBanner() {
    var banner = document.getElementById('cookie-consent-banner');
    if (banner) banner.hidden = false;
  }

  function hideBanner() {
    var banner = document.getElementById('cookie-consent-banner');
    if (banner) banner.hidden = true;
  }

  function choose(value) {
    var tagsWereLoaded = optionalTagsLoaded;
    saveChoice(value);
    if (value === 'accepted') {
      loadOptionalTags();
      hideBanner();
      return;
    }
    setGoogleConsent(false);
    hideBanner();
    // A previously loaded script cannot be removed reliably. Reload after withdrawal
    // so the stored rejection is applied before optional tags can load on the next view.
    if (tagsWereLoaded) window.location.reload();
  }

  function initialize() {
    // Consent is denied by default before any optional Google script is requested.
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted'
    });

    var accept = document.getElementById('cookie-consent-accept');
    var reject = document.getElementById('cookie-consent-reject');
    var settings = document.getElementById('open-cookie-settings');

    if (accept) accept.addEventListener('click', function () { choose('accepted'); });
    if (reject) reject.addEventListener('click', function () { choose('rejected'); });
    if (settings) settings.addEventListener('click', function () {
      if (typeof window.closePrivacyModal === 'function') window.closePrivacyModal();
      showBanner();
    });

    var choice = readChoice();
    if (choice === 'accepted') {
      loadOptionalTags();
      hideBanner();
    } else if (choice === 'rejected') {
      setGoogleConsent(false);
      hideBanner();
    } else {
      setGoogleConsent(false);
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }

  window.addEventListener('pageshow', function () {
    var choice = readChoice();
    if (choice === 'accepted') loadOptionalTags();
    else setGoogleConsent(false);
  });
})();
