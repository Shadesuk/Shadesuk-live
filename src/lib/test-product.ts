/** Same rule the sitemap uses to leave test products out of the public index. */
export function isSitemapTestProduct(product: { slug: string; isDemo: boolean }): boolean {
  if (product.isDemo) {
    return true;
  }
  return /^test\d*$/i.test(product.slug.trim());
}
