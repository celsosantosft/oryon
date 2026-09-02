const test = require('node:test');
const assert = require('node:assert/strict');

const { USER_REFERENCE_CLEANUP_STATEMENTS } = require('../utils/userDeletion');

test('user deletion clears historical references before deleting the account', () => {
    assert.ok(USER_REFERENCE_CLEANUP_STATEMENTS.includes('UPDATE order_history SET changed_by_user_id = NULL WHERE changed_by_user_id = ?'));
    assert.ok(USER_REFERENCE_CLEANUP_STATEMENTS.includes('UPDATE quote_history SET changed_by_user_id = NULL WHERE changed_by_user_id = ?'));
    assert.ok(USER_REFERENCE_CLEANUP_STATEMENTS.includes('UPDATE whatsapp_messages SET sent_by_user_id = NULL WHERE sent_by_user_id = ?'));
    assert.ok(USER_REFERENCE_CLEANUP_STATEMENTS.includes('UPDATE whatsapp_conversations SET assigned_user_id = NULL WHERE assigned_user_id = ?'));
});
