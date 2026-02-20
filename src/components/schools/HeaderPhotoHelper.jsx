// Helper component to display header photo with Clearbit fallback
export function isClearbitUrl(url) {
  if (!url) return false;
  return url.includes('clearbit.com') || url.includes('logo.clearbit');
}

export function HeaderPhotoDisplay({ headerPhotoUrl, heroImage, schoolName, height = 'h-96' }) {
  const isHeaderPhotoClearbit = isClearbitUrl(headerPhotoUrl);
  const isHeroImageClearbit = isClearbitUrl(heroImage);
  const hasValidHeaderPhoto = headerPhotoUrl && !isHeaderPhotoClearbit;
  const hasValidHeroImage = heroImage && !isHeroImageClearbit;

  // BUG FIX #7: Check both headerPhotoUrl and heroImage for Clearbit
  if (hasValidHeaderPhoto) {
    return (
      <img 
        src={headerPhotoUrl} 
        alt={schoolName}
        className={`w-full ${height} object-cover`}
      />
    );
  }

  if (hasValidHeroImage) {
    return (
      <img 
        src={heroImage} 
        alt={schoolName}
        className={`w-full ${height} object-cover`}
      />
    );
  }

  // Default gradient with school name
  return (
    <div className={`w-full ${height} flex items-center justify-center bg-gradient-to-br from-teal-600 to-blue-700 relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white rounded-full mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-white rounded-full mix-blend-screen" />
      </div>
      <div className="relative z-10 text-center text-white px-6">
        <div className="text-6xl font-bold opacity-30 mb-4">{schoolName.charAt(0).toUpperCase()}</div>
        <p className="text-xl font-light">{schoolName}</p>
      </div>
    </div>
  );
}

export function LogoDisplay({ logoUrl, schoolName, size = 'h-12 w-12' }) {
  if (!logoUrl) {
    return (
      <div className={`${size} rounded-lg bg-teal-600 text-white font-bold flex items-center justify-center text-sm flex-shrink-0`}>
        {schoolName.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={schoolName}
      className={`${size} rounded-lg object-cover bg-white/10 flex-shrink-0`}
    />
  );
}