package ru.smu.employee;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Приложение сотрудника СМУ: окно браузера (WebView), в котором открывается сайт приложения.
 * Всё содержимое приходит с сайта, поэтому обновления появляются сами при следующем запуске —
 * APK переустанавливать не нужно. Без интернета страница открывается из кэша service worker'а.
 */
public class MainActivity extends Activity {

    private static final String APP_URL = BuildConfig.APP_URL;

    private WebView webView;
    private View offlineView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        offlineView = buildOfflineView();
        offlineView.setVisibility(View.GONE);
        root.addView(offlineView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage — данные и офлайн-очередь приложения
        s.setDatabaseEnabled(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);                    // вёрстка не «разъезжается» от крупного шрифта в системе
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(s.getUserAgentString() + " SMUmApp/" + BuildConfig.VERSION_NAME);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient()); // confirm()/alert() показываются как диалоги
        webView.setWebViewClient(new AppClient());

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL);
        }
    }

    private View buildOfflineView() {
        float dp = getResources().getDisplayMetrics().density;

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(Color.WHITE);
        box.setPadding((int) (32 * dp), 0, (int) (32 * dp), 0);

        TextView title = new TextView(this);
        title.setText("Нет соединения");
        title.setTextSize(20);
        title.setTextColor(Color.parseColor("#1C1F24"));
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        TextView text = new TextView(this);
        text.setText("Приложение откроется, как только появится интернет. "
                + "После первого запуска оно работает и без связи.");
        text.setTextSize(15);
        text.setTextColor(Color.parseColor("#5A5F66"));
        text.setGravity(Gravity.CENTER);
        text.setPadding(0, (int) (12 * dp), 0, (int) (24 * dp));
        box.addView(text);

        Button retry = new Button(this);
        retry.setText("Повторить");
        retry.setTextColor(Color.WHITE);
        retry.setBackgroundColor(Color.parseColor("#0202FA"));
        retry.setOnClickListener(v -> {
            offlineView.setVisibility(View.GONE);
            webView.loadUrl(APP_URL);
        });
        box.addView(retry);
        return box;
    }

    private static boolean isAppUrl(Uri uri) {
        Uri app = Uri.parse(APP_URL);
        return app.getHost() != null && app.getHost().equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null && uri.getPath().startsWith(app.getPath());
    }

    private class AppClient extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            String scheme = uri.getScheme();
            if (("https".equals(scheme) || "http".equals(scheme)) && isAppUrl(uri)) {
                return false; // страницы приложения — внутри окна
            }
            // Остальное (tel:, mailto:, карты, сторонние сайты) — во внешних приложениях
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException ignored) {
            }
            return true;
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            offlineView.setVisibility(View.GONE);
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (request.isForMainFrame()) {
                offlineView.setVisibility(View.VISIBLE);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (offlineView.getVisibility() != View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        CookieManager.getInstance().flush();
    }

    @Override
    protected void onPause() {
        webView.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
