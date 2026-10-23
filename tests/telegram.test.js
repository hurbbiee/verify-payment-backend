const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matches } = require("../src/routes/telegram.routes");
test("webhook secret requires an exact non-empty match", () => {
  assert.equal(matches("secret", "secret"), true);
  assert.equal(matches("wrong", "secret"), false);
  assert.equal(matches(undefined, "secret"), false);
  assert.equal(matches("", ""), false);
});
const { groupPolicy } = require('../src/utils/telegram-policy');
test('group verification uses chat allowlist; private chat uses user allowlist', () => {
  const m = {chat:{type:'supergroup',id:-100123},from:{id:7},caption:'/v@qc_sleep_bot'};
  const env = {TELEGRAM_ALLOWED_USER_IDS:'7',TELEGRAM_ALLOWED_CHAT_IDS:'-100123'};
  assert.deepEqual(groupPolicy(m,env), {group:true,command:'/v',allowedUser:true,allowedChat:true,canVerify:true});
  assert.equal(groupPolicy(m,{...env,TELEGRAM_ALLOWED_CHAT_IDS:''}).allowedChat,false);
  assert.equal(groupPolicy(m,{...env,TELEGRAM_ALLOWED_USER_IDS:''}).allowedUser,false);
  assert.equal(groupPolicy({...m,caption:'/v@other_bot'},env).command,'');
  assert.equal(groupPolicy({...m,caption:''},env).command,'');
});

test('all members in an allowed group can verify without a user allowlist', () => {
  const env = { TELEGRAM_ALLOWED_CHAT_IDS: '-100123', TELEGRAM_ALLOWED_USER_IDS: '' };
  assert.equal(groupPolicy({chat:{type:'supergroup',id:-100123},from:{id:999},text:'/v'}, env).canVerify,true);
  assert.equal(groupPolicy({chat:{type:'supergroup',id:-999},from:{id:999},text:'/v'}, env).canVerify,false);
  assert.equal(groupPolicy({chat:{type:'private',id:999},from:{id:999},text:'/v'}, env).canVerify,false);
});