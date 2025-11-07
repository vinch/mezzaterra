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

  // Use total_price from database if it exists, otherwise calculate it from order items
  if (orders) {
    const ordersWithTotal = await Promise.all(
      orders.map(async (order) => {
        // If total_price already exists in the database and is not 0, use it
        if (order.total_price != null && order.total_price !== 0) {
          return order;
        }

        // Otherwise, calculate it from order items
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
            const price = item.price || item.wine_vintage?.purchase_price || 0;
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
