const USER_REFERENCE_CLEANUP_STATEMENTS = [
    ['orders', 'created_by_user_id'],
    ['quotes', 'created_by_user_id'],
    ['order_history', 'changed_by_user_id'],
    ['quote_history', 'changed_by_user_id'],
    ['whatsapp_conversations', 'assigned_user_id'],
    ['whatsapp_messages', 'sent_by_user_id'],
    ['whatsapp_conversation_orders', 'created_by_user_id'],
    ['meta_capi_events', 'created_by_user_id'],
    ['notifications', 'user_id']
].map(([table, column]) => `UPDATE ${table} SET ${column} = NULL WHERE ${column} = ?`);

module.exports = {
    USER_REFERENCE_CLEANUP_STATEMENTS
};
