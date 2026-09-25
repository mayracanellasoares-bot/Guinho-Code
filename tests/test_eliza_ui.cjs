const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('eliza-dev-pwa/ui-v4.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'embedded browser script must exist');
assert.ok(html.includes('id="history"'));
assert.ok(html.includes('id="model"'));
assert.ok(html.includes('id="files"'));
assert.ok(html.includes('menu-open'));
assert.ok(!script.includes('innerHTML='), 'answers must not be inserted as HTML');

function element(tag) {
  return {
    tag, className: '', children: [], textContent: '', listeners: {},
    append(...nodes) { this.children.push(...nodes); },
    appendChild(node) { this.children.push(node); return node; },
    replaceChildren(...nodes) { this.children = nodes; },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    setAttribute() {},
  };
}

const begin = script.indexOf('function renderText(');
const end = script.indexOf('async function copyText(', begin);
assert.ok(begin !== -1 && end > begin);
const renderText = vm.runInNewContext(script.slice(begin, end) + '\nrenderText', {
  document: { createElement: element }
});

test('fenced code is rendered in an isolated copyable panel', () => {
  const body = element('div');
  const fence = String.fromCharCode(96).repeat(3);
  renderText(body, 'Introdução\n' + fence + 'html\n<div>Olá</div>\n' + fence + '\nFim');
  assert.equal(body.children.length, 3);
  const panel = body.children[1];
  assert.equal(panel.className, 'code-panel');
  assert.equal(panel.children[0].children[0].textContent, 'HTML');
  assert.equal(panel.children[0].children[1].textContent, 'Copiar código');
  assert.equal(panel.children[1].children[0].textContent, '<div>Olá</div>');
});

test('untrusted markup is retained as plain text, not HTML', () => {
  const body = element('div');
  renderText(body, '<img src=x onerror=alert(1)>');
  assert.equal(body.children.length, 1);
  assert.equal(body.children[0].textContent, '<img src=x onerror=alert(1)>');
});
