"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getCartAction,
  removeCartItemAction,
  updateCartQuantityAction,
} from "@/app/cart/actions";
import { EMPTY_PUBLIC_CART, type PublicCart } from "@/types/cart";

export { EMPTY_PUBLIC_CART };

type CartContextValue = {
  cart: PublicCart;
  error: boolean;
  open: boolean;
  openBag: () => void;
  closeBag: () => void;
  applyCart: (cart: PublicCart) => void;
  refresh: () => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error("useCart must be used within CartProvider");
  }
  return value;
}

export function CartProvider({
  children,
  initialCart = EMPTY_PUBLIC_CART,
}: {
  children: ReactNode;
  initialCart?: PublicCart;
}) {
  const [cart, setCart] = useState<PublicCart>(initialCart);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const applyCart = useCallback((next: PublicCart) => {
    setCart(next);
    setError(false);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getCartAction();
    if (result.status === "ok") {
      applyCart(result.cart);
      return;
    }
    setError(true);
  }, [applyCart]);

  const openBag = useCallback(() => {
    setOpen(true);
    void refresh();
  }, [refresh]);

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      const result = await updateCartQuantityAction({ itemId, quantity });
      if (result.status !== "ok") {
        setError(true);
        return false;
      }
      applyCart(result.cart);
      return true;
    },
    [applyCart],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const result = await removeCartItemAction({ itemId });
      if (result.status !== "ok") {
        setError(true);
        return false;
      }
      applyCart(result.cart);
      return true;
    },
    [applyCart],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      error,
      open,
      openBag,
      closeBag: () => setOpen(false),
      applyCart,
      refresh,
      updateQuantity,
      removeItem,
    }),
    [applyCart, cart, error, open, openBag, refresh, removeItem, updateQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
