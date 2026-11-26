// Content script for Tab Organizer Pro
// Enhances all web pages with tab organization features

(function() {
    // Only run on non-Chrome pages
    if (window.location.href.startsWith('chrome://') || 
        window.location.href.startsWith('about:')) return;

    // Add data attributes for identification
    document.documentElement.setAttribute('data-tab-organizer', 'active');
    
    console.log('Tab Organizer Pro: Content script injected');
})();
