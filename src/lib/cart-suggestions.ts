import { isProductAvailable } from "@/lib/product-display";
import type { PublicCart } from "@/types/cart";
import type { Product } from "@/types/catalogue";

export function getCartSuggestions(cart: PublicCart, products: Product[]): Product[] {
  const inBag = new Set(cart.items.map((item) => item.productId));
  return products
    .filter((product) => isProductAvailable(product) && !inBag.has(product.id))
    .slice(0, 4);
}
