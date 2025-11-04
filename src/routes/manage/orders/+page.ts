import { supabase } from "$lib/supabase";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const { data: orders, error: ordersError } = await supabase
    .from("order")
    .select(
      `
      *,
      supplier (*),
      transport (
        *,
        transporter (*)
      )
    `
    )
    .order("date", { ascending: false });

  if (ordersError) {
    throw new Error(
      `Erreur lors du chargement des commandes: ${ordersError.message}`
    );
  }

  // Load order items for each order and calculate total_price
  if (orders) {
    const ordersWithTotal = await Promise.all(
      orders.map(async (order) => {
        const { data: orderItems } = await supabase
          .from("order_item")
          .select(
            `
            *,
            wine_vintage (
              purchase_price
            )
          `
          )
          .eq("order_id", order.id);

        let totalPrice = 0;
        if (orderItems) {
          totalPrice = orderItems.reduce((sum, item) => {
            // Use price from order_item if it exists, otherwise use purchase_price from wine_vintage
            const price =
              (item as any).price || item.wine_vintage?.purchase_price || 0;
            return sum + price * item.quantity;
          }, 0);
        }

        return {
          ...order,
          total_price: totalPrice,
        };
      })
    );

    return {
      orders: ordersWithTotal || [],
    };
  }

  return {
    orders: orders || [],
  };
};
