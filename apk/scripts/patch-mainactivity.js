#!/usr/bin/env node
/**
 * Pós `cap add android`: ajusta a MainActivity para o botão voltar do Android
 * navegar dentro da app (histórico do WebView) e, só na raiz, exigir dois
 * toques em "voltar" para sair (evita fechar sem querer).
 */
const fs = require('fs');
const path = require('path');

const javaDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java');
function findMain(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = findMain(p);
      if (r) return r;
    } else if (e.name === 'MainActivity.java') {
      return p;
    }
  }
  return null;
}

const mainPath = findMain(javaDir);
if (!mainPath) {
  console.error('✗ MainActivity.java não encontrado');
  process.exit(1);
}
let src = fs.readFileSync(mainPath, 'utf8');
if (src.includes('onBackPressed')) {
  console.log('• onBackPressed já existe');
  process.exit(0);
}

const override = `public class MainActivity extends BridgeActivity {
    private long lastBackPress = 0L;

    @Override
    public void onBackPressed() {
        android.webkit.WebView wv = bridge != null ? bridge.getWebView() : null;
        if (wv != null && wv.canGoBack()) {
            wv.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPress < 2000L) {
            super.onBackPressed();
        } else {
            lastBackPress = now;
            android.widget.Toast.makeText(this, "Pressione novamente para sair", android.widget.Toast.LENGTH_SHORT).show();
        }
    }
}`;

// substitui a classe vazia "public class MainActivity extends BridgeActivity {}"
const re = /public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{\s*\}/;
if (!re.test(src)) {
  console.error('✗ formato inesperado de MainActivity.java');
  process.exit(1);
}
src = src.replace(re, override);
fs.writeFileSync(mainPath, src);
console.log('✓ MainActivity com botão voltar (histórico) + saída com dois toques:', path.relative(process.cwd(), mainPath));
