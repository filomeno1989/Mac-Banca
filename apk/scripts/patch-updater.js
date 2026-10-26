#!/usr/bin/env node
/**
 * Pós `cap add android`: adiciona o plugin nativo HeliUpdate para a
 * atualização DENTRO da app:
 *   1. HeliUpdatePlugin.java (descarrega o APK com progresso e abre o
 *      instalador do sistema via FileProvider);
 *   2. registerPlugin(HeliUpdatePlugin.class) no MainActivity;
 *   3. permissão REQUEST_INSTALL_PACKAGES no AndroidManifest;
 *   4. <cache-path name="heliupdate" path="update/" /> no file_paths.xml
 *      (necessário para partilhar o ficheiro com o instalador).
 * Corre DEPOIS do patch-mainactivity.js.
 */
const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main');

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

const mainPath = findMain(path.join(androidDir, 'java'));
if (!mainPath) {
  console.error('✗ MainActivity.java não encontrado');
  process.exit(1);
}
const mainSrc = fs.readFileSync(mainPath, 'utf8');
const pkgMatch = mainSrc.match(/^package\s+([\w.]+);/m);
if (!pkgMatch) {
  console.error('✗ package de MainActivity não encontrado');
  process.exit(1);
}
const pkg = pkgMatch[1];
const pluginPath = path.join(path.dirname(mainPath), 'HeliUpdatePlugin.java');

// ---- 1. HeliUpdatePlugin.java -------------------------------------------
const PLUGIN_JAVA = `package ${pkg};

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Descarrega a nova versão da app (APK) dentro do próprio aparelho, com
 * progresso, e abre o instalador do Android. Evita sair para o navegador.
 */
@CapacitorPlugin(name = "HeliUpdate")
public class HeliUpdatePlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("http")) {
            call.reject("Endereço da atualização inválido.");
            return;
        }
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    Context ctx = getContext();
                    File dir = new File(ctx.getCacheDir(), "update");
                    if (!dir.exists()) dir.mkdirs();
                    File apk = new File(dir, "mac-banca-update.apk");
                    if (apk.exists()) apk.delete();

                    HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                    conn.setConnectTimeout(20000);
                    conn.setReadTimeout(60000);
                    conn.setRequestProperty("User-Agent", "Mac-Banca-Updater");
                    conn.connect();
                    int status = conn.getResponseCode();
                    if (status < 200 || status >= 300) {
                        call.reject("O servidor da atualização respondeu " + status + ".");
                        return;
                    }
                    int total = conn.getContentLength();
                    InputStream in = new BufferedInputStream(conn.getInputStream());
                    OutputStream out = new FileOutputStream(apk);
                    byte[] buf = new byte[8192];
                    int r;
                    long received = 0;
                    int lastPct = -1;
                    while ((r = in.read(buf)) != -1) {
                        out.write(buf, 0, r);
                        received += r;
                        if (total > 0) {
                            int pct = (int) (received * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                JSObject p = new JSObject();
                                p.put("received", received);
                                p.put("total", total);
                                p.put("percent", pct);
                                notifyListeners("progress", p);
                            }
                        }
                    }
                    out.flush();
                    out.close();
                    in.close();
                    conn.disconnect();

                    installApk(apk, call);
                } catch (Exception e) {
                    call.reject("Falha ao descarregar a atualização: " + e.getMessage());
                }
            }
        }).start();
    }

    private void installApk(File apk, PluginCall call) {
        Context ctx = getContext();
        try {
            // Android 8+: pedir autorização para instalar fontes desconhecidas
            if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
                Intent perm = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + ctx.getPackageName()));
                perm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(perm);
                call.reject("Falta a autorização de instalação. Autorize nas Definições e toque em Atualizar de novo.");
                return;
            }
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Falha ao abrir o instalador: " + e.getMessage());
        }
    }
}
`;
fs.writeFileSync(pluginPath, PLUGIN_JAVA);
console.log('✓ HeliUpdatePlugin.java criado (package ' + pkg + '):', path.relative(process.cwd(), pluginPath));

// ---- 2. registerPlugin no MainActivity -----------------------------------
let mSrc = fs.readFileSync(mainPath, 'utf8');
if (!mSrc.includes('registerPlugin(HeliUpdatePlugin')) {
  if (mSrc.includes('public void onCreate(')) {
    console.error('✗ onCreate já existe em MainActivity; insira registerPlugin manualmente');
    process.exit(1);
  }
  const anchor = /public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{/;
  if (!anchor.test(mSrc)) {
    console.error('✗ não encontrei a declaração de MainActivity');
    process.exit(1);
  }
  const onCreate = `public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(HeliUpdatePlugin.class);
    }`;
  mSrc = mSrc.replace(anchor, onCreate);
  fs.writeFileSync(mainPath, mSrc);
  console.log('✓ MainActivity regista HeliUpdatePlugin');
} else {
  console.log('• registerPlugin(HeliUpdatePlugin) já existe');
}

// ---- 3. Permissão REQUEST_INSTALL_PACKAGES -------------------------------
const manifestPath = path.join(androidDir, 'AndroidManifest.xml');
let manifest = fs.readFileSync(manifestPath, 'utf8');
if (!manifest.includes('REQUEST_INSTALL_PACKAGES')) {
  manifest = manifest.replace(
    /(\s*)<uses-permission\s/,
    `$1<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />$1<uses-permission `,
  );
  fs.writeFileSync(manifestPath, manifest);
  console.log('✓ Permissão REQUEST_INSTALL_PACKAGES adicionada');
} else {
  console.log('• Permissão REQUEST_INSTALL_PACKAGES já existe');
}

// ---- 4. cache-path para o FileProvider -----------------------------------
const xmlDir = path.join(androidDir, 'res', 'xml');
fs.mkdirSync(xmlDir, { recursive: true });
const fpPath = path.join(xmlDir, 'file_paths.xml');
const CACHE_TAG = '<cache-path name="heliupdate" path="update/" />';
if (!fs.existsSync(fpPath)) {
  fs.writeFileSync(
    fpPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<paths xmlns:android="http://schemas.android.com/apk/res/android">\n    ${CACHE_TAG}\n</paths>\n`,
  );
  console.log('✓ file_paths.xml criado com cache-path heliupdate');
} else {
  let fp = fs.readFileSync(fpPath, 'utf8');
  if (!fp.includes('name="heliupdate"')) {
    fp = fp.replace('</paths>', `    ${CACHE_TAG}\n</paths>`);
    fs.writeFileSync(fpPath, fp);
    console.log('✓ cache-path heliupdate adicionado ao file_paths.xml');
  } else {
    console.log('• file_paths.xml já tem cache-path heliupdate');
  }
}

// sanity check: o provider do Capacitor tem de existir no manifest
if (!manifest.includes('FileProvider')) {
  console.error('⚠ ATENÇÃO: nenhum FileProvider no AndroidManifest (instalador pode falhar)');
}
console.log('✓ Atualização in-app configurada');
