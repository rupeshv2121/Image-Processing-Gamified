// The site's name and mark, used by the landing page, sign-in page and sidebar.
export const SITE_NAME = 'Spatia'
export const SITE_TAGLINE = 'Spatial-domain image processing lab'

// A 3x3 kernel with its centre pixel highlighted
export function Logo() {
  return (
    <span className="logo" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
    </span>
  )
}
