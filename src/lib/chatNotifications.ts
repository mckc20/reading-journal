import { supabase } from "@/lib/supabase";
import type { ChatMessageNotification } from "@/types";

export async function getChatNotifications(): Promise<ChatMessageNotification[]> {
  const { data, error } = await supabase
    .from("chat_message_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as ChatMessageNotification[];
}

export async function markChatNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_chat_notification_read", {
    notification_uuid: notificationId,
  });

  if (error) throw error;
}
