import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CartItem, Product } from '../types';

interface CartContextValue {
  items: CartItem[];
  add: (product: Product, quantity: number) => void;
  remove: (productId: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextValue>(null!);
const CART_STORAGE_KEY = 'xupply_cart_v1';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return parsed.filter((i) => i && i.product && typeof i.product.id === 'number' && typeof i.quantity === 'number');
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen((prev) => !prev);

  const add = (product: Product, quantity: number) => {
    setItems((prev) => {
      const found = prev.find((i) => i.product.id === product.id);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
    setIsOpen(true);
  };

  const remove = (productId: number) => setItems((prev) => prev.filter((i) => i.product.id !== productId));

  const setQuantity = (productId: number, quantity: number) =>
    setItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i)).filter((i) => i.quantity > 0)
    );

  const clear = () => setItems([]);

  const total = items.reduce((a, i) => a + i.product.price_per_unit * i.quantity, 0);
  const count = items.reduce((a, i) => a + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        remove,
        setQuantity,
        clear,
        total,
        count,
        isOpen,
        openCart,
        closeCart,
        toggleCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}