// Single source of truth for the API backend.
// Change this ONE line to switch environments (e.g. http://localhost:8001).
window.API_BASE_URL = "https://api.b-oneinterior.com";
// window.API_BASE_URL = "http://localhost:8000";

// ─── Saleor channels ─────────────────────────────────────────────────────────
// Staff users can switch the active channel from their profile page. The
// selected channel is stored in localStorage and used by every page for
// product pricing, availability and checkout.
window.SALEOR_CHANNEL_STORAGE_KEY = 'saleor_channel';

// Fallback list used before the live channel list is loaded on the profile
// page (or if the channels query is unavailable).
window.SALEOR_CHANNELS = [
  { slug: 'in', name: 'Retail (IN)' },
  { slug: 'contractor', name: 'Contractor' },
  { slug: 'other', name: 'Other' }
];

window.isSaleorStaff = function () {
  return localStorage.getItem('saleor_user_is_staff') === 'true';
};

// Resolve the channel used for all Saleor queries.
// - Staff: the channel they explicitly selected (if any).
// - Everyone else: the channel tied to their account role.
window.getSaleorChannel = function () {
  var role = (localStorage.getItem('role') || '').toLowerCase();
  var roleChannel = (role === 'contractor' || role === 'other') ? role : 'in';

  if (window.isSaleorStaff()) {
    var selected = (localStorage.getItem(window.SALEOR_CHANNEL_STORAGE_KEY) || '').toLowerCase();
    if (selected) return selected;
  }

  return roleChannel;
};

window.getSaleorChannelName = function (slug) {
  var channels = window.SALEOR_CHANNELS || [];
  for (var i = 0; i < channels.length; i++) {
    if (channels[i].slug === slug) return channels[i].name;
  }
  return slug;
};

window.setSaleorChannel = function (slug) {
  slug = (slug || '').toLowerCase();
  if (!slug) {
    localStorage.removeItem(window.SALEOR_CHANNEL_STORAGE_KEY);
    return;
  }
  localStorage.setItem(window.SALEOR_CHANNEL_STORAGE_KEY, slug);
};
