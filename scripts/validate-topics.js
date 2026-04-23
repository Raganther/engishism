#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function runScript(relPath, sandbox) {
  const code = readFile(relPath);
  vm.runInContext(code, sandbox, { filename: relPath });
}

function createSandbox() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  return sandbox;
}

function assert(condition, message, errors) {
  if (!condition) errors.push(message);
}

function validateTopic(topic, errors) {
  const prefix = `topic ${topic && topic.id ? topic.id : '<unknown>'}`;
  assert(topic && typeof topic === 'object', `${prefix}: must export an object`, errors);
  if (!topic || typeof topic !== 'object') return;

  ['id', 'title', 'category', 'level'].forEach(key => {
    assert(typeof topic[key] === 'string' && topic[key].trim(), `${prefix}: missing string field "${key}"`, errors);
  });

  assert(Array.isArray(topic.vocabulary), `${prefix}: vocabulary must be an array`, errors);
  assert(Array.isArray(topic.examples), `${prefix}: examples must be an array`, errors);
  assert(Array.isArray(topic.fillBlanks), `${prefix}: fillBlanks must be an array`, errors);
  assert(Array.isArray(topic.pairs), `${prefix}: pairs must be an array`, errors);
  assert(Array.isArray(topic.discussionPrompts), `${prefix}: discussionPrompts must be an array`, errors);
  assert(topic.questions && typeof topic.questions === 'object', `${prefix}: questions bucket missing`, errors);

  if (topic.questions && typeof topic.questions === 'object') {
    ['multipleChoice', 'trueFalse', 'openEnded'].forEach(key => {
      assert(Array.isArray(topic.questions[key]), `${prefix}: questions.${key} must be an array`, errors);
    });
  }

  (topic.vocabulary || []).forEach((item, index) => {
    assert(typeof item.term === 'string' && item.term.trim(), `${prefix}: vocabulary[${index}] missing term`, errors);
  });
}

function main() {
  const sandbox = createSandbox();
  runScript('adapters/index.js', sandbox);
  runScript('topics/index.js', sandbox);

  const topics = sandbox.TOPIC_INDEX || [];
  const adapters = sandbox.GameAdapters || {};
  const errors = [];

  topics.forEach(meta => {
    assert(typeof meta.id === 'string' && meta.id, `topic index: missing id`, errors);
    assert(typeof meta.path === 'string' && meta.path, `topic index ${meta.id}: missing path`, errors);
    sandbox.TOPIC_PACK = null;
    runScript(meta.path, sandbox);
    validateTopic(sandbox.TOPIC_PACK, errors);
    assert(sandbox.TOPIC_PACK && sandbox.TOPIC_PACK.id === meta.id, `topic index ${meta.id}: loaded topic id mismatch`, errors);
  });

  if (errors.length) {
    console.error('Topic validation failed:\n');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Topic validation passed.\n');
  topics.forEach(meta => {
    sandbox.TOPIC_PACK = null;
    runScript(meta.path, sandbox);
    const topic = sandbox.TOPIC_PACK;
    const compatible = Object.keys(adapters).filter(type => adapters[type].canAdapt(topic));
    console.log(`${meta.id}: ${compatible.join(', ')}`);
  });
}

main();
