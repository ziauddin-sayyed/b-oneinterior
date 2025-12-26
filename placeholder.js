document.addEventListener('DOMContentLoaded', function () {
    const PLACEHOLDER_SRC = 'images/placeholder.png';

    function handleImageError(img) {
        if (!img.getAttribute('data-err-handled')) {
            img.src = PLACEHOLDER_SRC;
            img.setAttribute('data-err-handled', 'true');
            img.alt = 'Image not available';
        }
    }

    // Handle existing images
    document.querySelectorAll('img').forEach(img => {
        // If src is missing or empty
        if (!img.src || img.src === window.location.href) {
            handleImageError(img);
        }

        // Attach error listener
        img.onerror = function () {
            handleImageError(this);
        };

        // Check if image is already broken (complete but naturalWidth is 0)
        if (img.complete && img.naturalWidth === 0) {
            handleImageError(img);
        }
    });

    // Optional: Observe for new images added dynamically
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'IMG') {
                    node.onerror = function () { handleImageError(this); };
                    if (!node.src) handleImageError(node);
                } else if (node.querySelectorAll) {
                    node.querySelectorAll('img').forEach(img => {
                        img.onerror = function () { handleImageError(this); };
                        if (!img.src) handleImageError(img);
                    });
                }
            });
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
